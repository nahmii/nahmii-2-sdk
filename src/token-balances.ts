import { BigNumber, ethers } from 'ethers'
import { predeploys } from './predeploys'
import L2StandardERC20ABI from './contract-metadata/L2StandardERC20ABI.json'

/**
 * Balance of ETH
 *
 * @param {string} accountAddress Account address
 * @param {ethers.providers.JsonRpcProvider} l2Provider L1 provider
 * @param {ethers.providers.BlockTag} [block] Tag of block
 * @returns Returns the account's balance of ETH
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
 * @param {string} contractAddress L2 address of ERC20 contract instance
 * @param {string} accountAddress Account address
 * @param {ethers.providers.JsonRpcProvider} l2Provider L1 provider
 * @param {ethers.providers.BlockTag} [block] Tag of block
 * @returns Returns the account's balance of the ERC20 tokens
 */
export const balanceOfERC20 = async (
  contractAddress: string,
  accountAddress: string,
  l2Provider: ethers.providers.JsonRpcProvider,
  block?: ethers.providers.BlockTag
): Promise<BigNumber> => {
  const L2StandardERC20Interface = new ethers.utils.Interface(L2StandardERC20ABI)
  const contract = new ethers.Contract(contractAddress, L2StandardERC20Interface, l2Provider)
  const overrides = block ? { blockTag: block } : null
  return contract.balanceOf(accountAddress, overrides)
}
