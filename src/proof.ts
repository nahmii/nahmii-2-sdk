import { ethers, BigNumber } from 'ethers'
import * as rlp from './rlp'
import { toHexString, toRpcHexString, remove0x } from './string-format'
import { setFormattersForTransactions, formatNVMTx, formatNVMReceipt } from './l2context'

import L1CrossDomainMessengerMetadata from './contract-metadata/iNVM_L1CrossDomainMessenger.json'
import L2CrossDomainMessengerMetadata from './contract-metadata/NVM_L2CrossDomainMessenger.json'
import L2StandardBridgeMetadata from './contract-metadata/NVM_L2StandardBridge.json'

interface StateTrieProof {
  accountProof: string
  storageProof: string
}

interface CrossDomainMessagePair {
  messageToSend: CrossDomainMessage
  proof: CrossDomainMessageProof
}

interface CrossDomainMessage {
  target: string
  sender: string
  message: string
  messageNonce: number
}

interface CrossDomainMessageProof {
  stateRoot: string
  stateTrieWitness: string
  storageTrieWitness: string
}

export interface RelayResult {
  exceptions?: Error[]
  success: relayResults
  message: CrossDomainMessage
  messageProof: CrossDomainMessageProof
  transactionResponse?: ethers.providers.TransactionResponse
}

export enum relayResults {
  success,
  alreadyRelayed,
  failed,
  notSent,
}

const predeploys = {
  NVM_L2ToL1MessagePasser: '0x4200000000000000000000000000000000000000',
  NVM_L1MessageSender: '0x4200000000000000000000000000000000000001',
  NVM_DeployerWhitelist: '0x4200000000000000000000000000000000000002',
  NVM_ECDSAContractAccount: '0x4200000000000000000000000000000000000003',
  NVM_SequencerEntrypoint: '0x4200000000000000000000000000000000000005',
  NVM_ETH: '0x4200000000000000000000000000000000000006',
  NVM_L2CrossDomainMessenger: '0x4200000000000000000000000000000000000007',
  Lib_AddressManager: '0x4200000000000000000000000000000000000008',
  NVM_ProxyEOA: '0x4200000000000000000000000000000000000009',
  NVM_ExecutionManagerWrapper: '0x420000000000000000000000000000000000000B',
  NVM_GasPriceOracle: '0x420000000000000000000000000000000000000F',
  NVM_SequencerFeeVault: '0x4200000000000000000000000000000000000011',
  NVM_L2StandardBridge: '0x4200000000000000000000000000000000000010',
  ERC1820Registry: '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24',
}

/**
 * Generates a Merkle-Patricia trie proof for a given account and storage slot.
 *
 * @param l2RpcProvider L2 RPC provider.
 * @param blockNumber Block number to generate the proof at.
 * @param address Address to generate the proof for.
 * @param slot Storage slot to generate the proof for.
 * @returns Account proof and storage proof.
 */
const getStateTrieProof = async (
  l2RpcProvider: ethers.providers.JsonRpcProvider,
  blockNumber: number,
  address: string,
  slot: string
): Promise<StateTrieProof> => {
  const proof = await l2RpcProvider.send('eth_getProof', [address, [slot], toRpcHexString(blockNumber)])

  return {
    accountProof: toHexString(rlp.encode(proof.accountProof)),
    storageProof: toHexString(rlp.encode(proof.storageProof[0].proof)),
  }
}

/**
 * Encodes a cross domain message.
 *
 * @param message Message to encode.
 * @returns Encoded message.
 */
const encodeCrossDomainMessage = (message: CrossDomainMessage): string => {
  return new ethers.utils.Interface(L2CrossDomainMessengerMetadata.abi).encodeFunctionData('relayMessage', [
    message.target,
    message.sender,
    message.message,
    message.messageNonce,
  ])
}

/**
 * Finds all L2 => L1 messages triggered by a given L2 transaction, if the message exists.
 *
 * @param l2RpcProvider L2 RPC provider.
 * @param l2CrossDomainMessengerAddress Address of the L2CrossDomainMessenger.
 * @param l2TransactionHash Hash of the L2 transaction to find a message for.
 * @returns Messages associated with the transaction.
 */
export const getMessagesByTransactionHash = async (
  l2RpcProvider: ethers.providers.Provider,
  l2CrossDomainMessengerAddress: string,
  l2TransactionHash: string
): Promise<CrossDomainMessage[]> => {
  // Complain if we can't find the given transaction.
  const transaction = await l2RpcProvider.getTransaction(l2TransactionHash)
  if (transaction === null) {
    throw new Error(`unable to find tx with hash: ${l2TransactionHash}`)
  }

  const L2CrossDomainMessengerInterface = new ethers.utils.Interface(L2CrossDomainMessengerMetadata.abi)
  const l2CrossDomainMessenger = new ethers.Contract(
    l2CrossDomainMessengerAddress,
    L2CrossDomainMessengerInterface,
    l2RpcProvider
  )

  // Find all SentMessage events created in the same block as the given transaction. This is
  // reliable because we should only have one transaction per block.
  const sentMessageEvents = await l2CrossDomainMessenger.queryFilter(
    l2CrossDomainMessenger.filters.SentMessage(),
    transaction.blockNumber,
    transaction.blockNumber
  )

  // Decode the messages and turn them into a nicer struct.
  const sentMessages = sentMessageEvents
    .filter((messageEvent) => messageEvent?.args?.message !== undefined)
    .map((sentMessageEvent) => {
      const encodedMessage = sentMessageEvent?.args?.message
      const decodedMessage = l2CrossDomainMessenger.interface.decodeFunctionData('relayMessage', encodedMessage)

      return {
        target: decodedMessage._target,
        sender: decodedMessage._sender,
        message: decodedMessage._message,
        messageNonce: decodedMessage._messageNonce.toNumber(),
      }
    })

  return sentMessages
}

/**
 * Finds all L2 => L1 messages sent in a given L2 transaction and generates proofs for each of
 * those messages.
 *
 * @param l2RpcProvider L2 RPC provider.
 * @param l2CrossDomainMessengerAddress Address of the L2CrossDomainMessenger.
 * @param l2TransactionHash L2 transaction hash to generate a relay transaction for.
 * @returns An array of messages sent in the transaction and a proof of inclusion for each.
 */
export const getMessagesAndProofsForL2Transaction = async (
  l2RpcProvider: ethers.providers.JsonRpcProvider | string,
  l2CrossDomainMessengerAddress: string,
  l2TransactionHash: string
): Promise<CrossDomainMessagePair[]> => {
  if (typeof l2RpcProvider === 'string') {
    l2RpcProvider = new ethers.providers.JsonRpcProvider(l2RpcProvider)
  }

  const l2Receipt = await setFormattersForTransactions(l2RpcProvider).getTransactionReceipt(l2TransactionHash)

  if (l2Receipt === null || l2Receipt.root == null) {
    throw new Error(`unable to find receipt with hash: ${l2TransactionHash}`)
  }

  // Find every message that was sent during this transaction. We'll then attach a proof for each.
  const messages = await getMessagesByTransactionHash(l2RpcProvider, l2CrossDomainMessengerAddress, l2TransactionHash)

  const messagePairs: CrossDomainMessagePair[] = []
  for (const message of messages) {
    // We need to calculate the specific storage slot that demonstrates that this message was
    // actually included in the L2 chain. The following calculation is based on the fact that
    // messages are stored in the following mapping on L2:
    // https://github.com/ethereum-optimism/optimism/blob/c84d3450225306abbb39b4e7d6d82424341df2be/packages/contracts/contracts/optimistic-ethereum/OVM/predeploys/OVM_L2ToL1MessagePasser.sol#L23
    // You can read more about how Solidity storage slots are computed for mappings here:
    // https://docs.soliditylang.org/en/v0.8.4/internals/layout_in_storage.html#mappings-and-dynamic-arrays
    const messageSlot = ethers.utils.keccak256(
      ethers.utils.keccak256(encodeCrossDomainMessage(message) + remove0x(l2CrossDomainMessengerAddress)) +
        '00'.repeat(32)
    )

    // We need a Merkle trie proof for the given storage slot. This allows us to prove to L1 that
    // the message was actually sent on L2.
    const stateTrieProof = await getStateTrieProof(
      l2RpcProvider,
      l2Receipt.blockNumber,
      predeploys.NVM_L2ToL1MessagePasser,
      messageSlot
    )

    // We now have enough information to create the message proof.
    const proof: CrossDomainMessageProof = {
      stateRoot: l2Receipt.root,
      stateTrieWitness: stateTrieProof.accountProof,
      storageTrieWitness: stateTrieProof.storageProof,
    }

    messagePairs.push({
      messageToSend: message,
      proof,
    })
  }

  return messagePairs
}

/**
 * Basic timeout-based async sleep function.
 *
 * @param ms Number of milliseconds to sleep.
 */
export const sleep = async (ms: number): Promise<void> => {
  return new Promise<void>((resolve, _) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

/**
 * Initiate withdrawals.
 *
 * @param l2TokenAddress L2 address of the to be withdrawn token.
 * @param withdrawAmount The amount to withdraw.
 * @param l2Provider L2 provider.
 * @param signer L2 transaction signer.
 * @returns Returns the transaction response containing metadata for the withdrawal transaction.
 */
export const withdraw = async (
  l2TokenAddress: string,
  withdrawAmount: BigNumber,
  l2Provider: ethers.providers.JsonRpcProvider,
  signer: ethers.Signer
): Promise<ethers.providers.TransactionResponse> => {
  const L2StandardBridgeInterface = new ethers.utils.Interface(L2StandardBridgeMetadata.abi)
  const contract = new ethers.Contract(predeploys.NVM_L2StandardBridge, L2StandardBridgeInterface, l2Provider)
  const signerWithProvider = signer.connect(l2Provider)
  const transactionResponse = await contract
    .connect(signerWithProvider)
    .withdraw(l2TokenAddress, withdrawAmount, 0, '0x')

  return transactionResponse
}

/**
 * Relays all L2 => L1 messages found in a given L2 transaction.
 *
 * @param l2TransactionHash L2 transaction hash to find the messages in.
 * @param l1CrossDomainMessengerAddress Address of the l1CrossDomainMessenger.
 * @param l1RpcProvider L1 provider.
 * @param l2RpcProvider L2 provider.
 * @param l1Signer L1 transaction signer.
 * @param maxRetries maximum retries for relaying messages.
 */
export const relayXDomainMessages = async (
  l2TransactionHash: string,
  l1CrossDomainMessengerAddress: string,
  l1RpcProvider: ethers.providers.JsonRpcProvider,
  l2RpcProvider: ethers.providers.JsonRpcProvider,
  l1Signer: ethers.Signer,
  maxRetries: number = 5
): Promise<RelayResult[]> => {
  const extendedL2Provider = setFormattersForTransactions(l2RpcProvider)
  const extendedL2Tx = await extendedL2Provider.getTransaction(l2TransactionHash)
  const extendedL2Receipt = await extendedL2Provider.getTransactionReceipt(l2TransactionHash)

  const nvmTx = formatNVMTx(extendedL2Tx)
  const nvmReceipt = formatNVMReceipt(extendedL2Receipt)

  const L1CrossDomainMessengerInterface = new ethers.utils.Interface(L1CrossDomainMessengerMetadata.abi)
  const l1Messenger = new ethers.Contract(l1CrossDomainMessengerAddress, L1CrossDomainMessengerInterface, l1RpcProvider)

  const messagePairs = await getMessagesAndProofsForL2Transaction(
    extendedL2Provider,
    predeploys.NVM_L2CrossDomainMessenger,
    l2TransactionHash
  )

  const results: RelayResult[] = messagePairs.map((messagePair): RelayResult => {
    return { success: relayResults.notSent, message: messagePair.messageToSend, messageProof: messagePair.proof }
  })
  const signerWithProvider = l1Signer.connect(l1RpcProvider)
  for (const [index, { messageToSend, proof }] of messagePairs.entries()) {
    let errorCounter = 0
    const errors: Error[] = []
    results[index].exceptions = errors
    while (true) {
      try {
        const result = await l1Messenger
          .connect(signerWithProvider)
          .relayMessage(
            messageToSend.target,
            messageToSend.sender,
            messageToSend.message,
            messageToSend.messageNonce,
            nvmTx,
            nvmReceipt,
            proof
          )
        const txResponse = await result.wait()
        results[index] = { ...results[index], success: relayResults.success, transactionResponse: txResponse }
        break
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (e.message.includes('message has already been received')) {
            results[index].success = relayResults.alreadyRelayed
            break
          }
          if (e.message.includes('execution failed due to an exception') || e.message.includes('Nonce too low')) {
            if (errorCounter < maxRetries) {
              errorCounter++
              await sleep(1000)
              continue
            }
          }
          errors.push(e)
        }
        results[index].success = relayResults.failed
        return results // Returns early like the throw that was here before
      }
    }
  }
  return results
}
