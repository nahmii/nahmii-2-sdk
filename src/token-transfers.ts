import { ethers } from 'ethers'
import { predeploys } from './predeploys'
import L2StandardERC20ABI from './contract-metadata/L2StandardERC20ABI.json'
import { Transfer } from './types'

/**
 * Transfers of ETH
 *
 * @param accountAddress Account address
 * @param l2Provider L1 provider
 * @param [fromBlock] Tag of from block
 * @param [toBlock] Tag of to block
 * @returns Returns the transfers of ETH
 */
export const transfersOfETH = async (
  accountAddress: string,
  l2Provider: ethers.providers.JsonRpcProvider,
  fromBlock?: ethers.providers.BlockTag,
  toBlock?: ethers.providers.BlockTag
): Promise<Array<Transfer>> => {
  return transfersOfERC20(predeploys.NVM_ETH, accountAddress, l2Provider, fromBlock, toBlock)
}

/**
 * Transfers of ERC20 token
 *
 * @param contractAddress L2 address of ERC20 contract instance
 * @param accountAddress Account address
 * @param l2Provider L1 provider
 * @param [fromBlock] Tag of from block
 * @param [toBlock] Tag of to block
 * @returns Returns the transfers of the ERC20 token
 */
export const transfersOfERC20 = async (
  contractAddress: string,
  accountAddress: string,
  l2Provider: ethers.providers.JsonRpcProvider,
  fromBlock?: ethers.providers.BlockTag,
  toBlock?: ethers.providers.BlockTag
): Promise<Array<Transfer>> => {
  const L2StandardERC20Interface = new ethers.utils.Interface(L2StandardERC20ABI)
  const contract = new ethers.Contract(contractAddress, L2StandardERC20Interface, l2Provider)

  const [sends, receives] = await Promise.all([
    contract.queryFilter(contract.filters.Transfer(accountAddress, undefined), fromBlock, toBlock),
    contract.queryFilter(contract.filters.Transfer(undefined, accountAddress), fromBlock, toBlock),
  ])

  const transfers = await Promise.all(
    [...sends, ...receives].map(async (ev) => {
      const [sender, recipient, amount] = ev.args as Array<any>
      const transactionReceipt = await ev.getTransactionReceipt()

      const transfer = {
        contractAddress,
        sender,
        recipient,
        amount,
        transactionReceipt,
      }

      return transfer
    })
  )

  return transfers
}
