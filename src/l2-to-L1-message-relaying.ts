import { ethers } from 'ethers'
import { setTxOptionsForL2, formatNVMTx, formatNVMReceipt } from './l2-tx-formatting'
import { CrossDomainMessageProof, GetTransactionProof } from './tx-proof'
export { CrossDomainMessageProof }
import { predeploys } from './predeploys'

import L1CrossDomainMessengerMetadata from './contract-metadata/iNVM_L1CrossDomainMessenger.json'
import L2CrossDomainMessengerMetadata from './contract-metadata/NVM_L2CrossDomainMessenger.json'

interface CrossDomainMessagePair {
  message: CrossDomainMessage
  proof: CrossDomainMessageProof
}

export interface CrossDomainMessage {
  target: string
  sender: string
  message: string
  messageNonce: number
}

export interface RelayResult {
  exceptions?: Error[]
  success: relayResults
  message: CrossDomainMessage
  messageProof: CrossDomainMessageProof
  transactionReceipt?: ethers.providers.TransactionReceipt
}

export enum relayResults {
  success,
  alreadyRelayed,
  failed,
  notSent,
}

/**
 * Finds all L2 => L1 messages triggered by a given L2 transaction, if the message exists.
 *
 * @param l2RpcProvider L2 RPC provider.
 * @param l2CrossDomainMessengerAddress Address of the L2CrossDomainMessenger.
 * @param l2TransactionHash Hash of the L2 transaction to find a message for.
 * @returns Messages associated with the transaction.
 */
export const getL2ToL1MessagesByTransactionHash = async (
  l2RpcProvider: ethers.providers.Provider,
  l2CrossDomainMessengerAddress: string,
  l2TransactionHash: string
): Promise<CrossDomainMessage[]> => {
  // Complain if we can't find the given transaction.
  const transaction = await l2RpcProvider.getTransaction(l2TransactionHash)
  if (transaction?.blockNumber == null) {
    throw new Error(`unable to find tx with hash: ${l2TransactionHash}`)
  }

  return getL2ToL1MessagesByBlock(l2RpcProvider, l2CrossDomainMessengerAddress, transaction.blockNumber)
}

/**
 * Get messages being sent from L2 to L1 for a specific block
 *
 * @param l2RpcProvider
 * @param l2CrossDomainMessengerAddress
 * @param l2Block Either blocknumber or blockhash
 */
export const getL2ToL1MessagesByBlock = async (
  l2RpcProvider: ethers.providers.Provider,
  l2CrossDomainMessengerAddress: string,
  l2Block: number | string
): Promise<CrossDomainMessage[]> => {
  const L2CrossDomainMessengerInterface = new ethers.utils.Interface(L2CrossDomainMessengerMetadata.abi)
  const l2CrossDomainMessenger = new ethers.Contract(
    l2CrossDomainMessengerAddress,
    L2CrossDomainMessengerInterface,
    l2RpcProvider
  )

  const blockFilter = typeof l2Block === 'number' ? [l2Block, l2Block] : [l2Block]
  // Find all SentMessage events created in the same block as the given transaction. This is
  // reliable because we should only have one transaction per block.
  const sentMessageEvents = await l2CrossDomainMessenger.queryFilter(
    l2CrossDomainMessenger.filters.SentMessage(),
    ...blockFilter
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

  const receipt = await setTxOptionsForL2(l2RpcProvider).getTransactionReceipt(l2TransactionHash)
  if (receipt == null) {
    throw new Error(`unable to find receipt with hash: ${l2TransactionHash}`)
  }

  // Find every message that was sent during this transaction. We'll then attach a proof for each.
  const messages = await getL2ToL1MessagesByTransactionHash(
    l2RpcProvider,
    l2CrossDomainMessengerAddress,
    l2TransactionHash
  )

  const messagePairs: CrossDomainMessagePair[] = []
  for (const message of messages) {
    const proof = await GetTransactionProof(
      encodeCrossDomainMessage(message),
      receipt,
      l2CrossDomainMessengerAddress,
      l2RpcProvider
    )
    messagePairs.push({ message, proof })
  }

  return messagePairs
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
 * Relays all L2 => L1 messages found in a given L2 transaction.
 * The function will block until all messages are on the L1 chain.
 *
 * @param l2TransactionHash L2 transaction hash to find the messages in.
 * @param l1CrossDomainMessengerAddress Address of the l1CrossDomainMessenger.
 * @param l1RpcProvider L1 provider.
 * @param l2RpcProvider L2 provider.
 * @param l1Signer L1 transaction signer.
 * @param maxRetries maximum retries if error when relaying messages. Default = 5
 * @param confirms Amount of blocks to confirm a transaction. Default = 1
 * @param transactionCallback will be called with TransactionResponse after each message is relayed,
 * but before waiting for the result.
 * @returns an array containing the results of all the messages that were to be sent
 */
export const relayL2ToL1Messages = async (
  l2TransactionHash: string,
  l1CrossDomainMessengerAddress: string,
  l1RpcProvider: ethers.providers.JsonRpcProvider,
  l2RpcProvider: ethers.providers.JsonRpcProvider,
  l1Signer: ethers.Signer,
  maxRetries: number = 5,
  confirms: number = 1,
  transactionCallback?: (response: ethers.providers.TransactionResponse) => void
): Promise<RelayResult[]> => {
  const extendedL2Provider = setTxOptionsForL2(l2RpcProvider)
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
    return { success: relayResults.notSent, message: messagePair.message, messageProof: messagePair.proof }
  })
  const signerWithProvider = l1Signer.connect(l1RpcProvider)
  for (const [index, { message, proof }] of messagePairs.entries()) {
    let errorCounter = 0
    const errors: Error[] = []
    results[index].exceptions = errors
    while (true) {
      try {
        const result = await l1Messenger
          .connect(signerWithProvider)
          .relayMessage(message.target, message.sender, message.message, message.messageNonce, nvmTx, nvmReceipt, proof)
        if (transactionCallback) {
          transactionCallback(result)
        }
        const txReceipt = await result.wait(confirms)
        results[index] = { ...results[index], success: relayResults.success, transactionReceipt: txReceipt }
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
