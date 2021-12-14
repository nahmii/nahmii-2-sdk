import { ethers } from 'ethers'
import * as rlp from 'rlp'
import { toHexString, toRpcHexString } from './string-format'


interface StateTrieProof {
  accountProof: string
  storageProof: string
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
    const proof = await l2RpcProvider.send('eth_getProof', [
      address,
      [slot],
      toRpcHexString(blockNumber),
    ])
  
    return {
      accountProof: toHexString(rlp.encode(proof.accountProof)),
      storageProof: toHexString(rlp.encode(proof.storageProof[0].proof)),
    }
  }