import { BigNumber, ethers } from 'ethers'
import { predeploys } from './predeploys'
import L2StandardERC20ABI from './contract-metadata/L2StandardERC20ABI.json'

/**
 * Balance of ETH
 *
 * @param accountAddress Account address
 * @param l2Provider L1 provider
 * @param [toBlock] Tag of block
 * @returns Returns the string typed balance of ETH
 */
export const balanceOfETH = async (
  accountAddress: string,
  l2Provider: ethers.providers.JsonRpcProvider,
  block?: ethers.providers.BlockTag
): Promise<BigNumber> => {
  return balanceOfERC20(predeploys.NVM_ETH, accountAddress, l2Provider, block)
}

/**
 * Balance of ERC20 token
 *
 * @param l2TokenAddress L2 address of ERC20 token instance
 * @param accountAddress Account address
 * @param l2Provider L1 provider
 * @param [toBlock] Tag of block
 * @returns Returns the string typed balance of the account
 */
export const balanceOfERC20 = async (
  l2TokenAddress: string,
  accountAddress: string,
  l2Provider: ethers.providers.JsonRpcProvider,
  block?: ethers.providers.BlockTag
): Promise<BigNumber> => {
  const L2StandardERC20Interface = new ethers.utils.Interface(L2StandardERC20ABI)
  const contract = new ethers.Contract(l2TokenAddress, L2StandardERC20Interface, l2Provider)
  const overrides = block ? { blockTag: block } : undefined
  const balance = await contract.balanceOf(accountAddress, overrides)

  return balance
}
