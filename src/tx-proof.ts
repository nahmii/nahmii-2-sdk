import { ethers } from 'ethers'
import { remove0x, toHexString, toRpcHexString } from './string-format'
import { predeploys } from './predeploys'
import * as rlp from './rlp'

interface StateTrieProof {
  accountProof: string
  storageProof: string
}

export interface CrossDomainMessageProof {
  stateRoot: string
  stateTrieWitness: string
  storageTrieWitness: string
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
export const getStateTrieProof = async (
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
 * Generate proofs for transactions
 *
 * @param encodedMessage the encoded message of the transaction
 * @param receipt transaction receipt
 * @param l2CrossDomainMessengerAddress
 * @param l2RpcProvider
 * @constructor
 */
export const GetTransactionProof = async (
  encodedMessage: string,
  receipt: ethers.providers.TransactionReceipt,
  l2CrossDomainMessengerAddress: string,
  l2RpcProvider: ethers.providers.JsonRpcProvider
): Promise<CrossDomainMessageProof> => {
  // We need to calculate the specific storage slot that demonstrates that this message was
  // actually included in the L2 chain. The following calculation is based on the fact that
  // messages are stored in the following mapping on L2:
  // https://github.com/ethereum-optimism/optimism/blob/c84d3450225306abbb39b4e7d6d82424341df2be/packages/contracts/contracts/optimistic-ethereum/OVM/predeploys/OVM_L2ToL1MessagePasser.sol#L23
  // You can read more about how Solidity storage slots are computed for mappings here:
  // https://docs.soliditylang.org/en/v0.8.4/internals/layout_in_storage.html#mappings-and-dynamic-arrays
  const messageSlot = ethers.utils.keccak256(
    ethers.utils.keccak256(encodedMessage + remove0x(l2CrossDomainMessengerAddress)) + '00'.repeat(32)
  )

  // We need a Merkle trie proof for the given storage slot. This allows us to prove to L1 that
  // the message was actually sent on L2.
  const stateTrieProof = await getStateTrieProof(
    l2RpcProvider,
    receipt.blockNumber,
    predeploys.NVM_L2ToL1MessagePasser,
    messageSlot
  )

  // We now have enough information to create the message proof.
  const proof: CrossDomainMessageProof = {
    stateRoot: receipt.root!,
    stateTrieWitness: stateTrieProof.accountProof,
    storageTrieWitness: stateTrieProof.storageProof,
  }

  return proof
}
