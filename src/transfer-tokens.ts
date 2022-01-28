import { BigNumber, ethers } from 'ethers'
import { predeploys } from './predeploys'
import L1StandardBridgeABI from './contract-metadata/L1StandardBridgeABI.json'
import L2StandardBridgeABI from './contract-metadata/L2StandardBridgeABI.json'
import { relayL2ToL1Messages } from './l2-to-L1-message-relaying'
import { ETH_GAS_LIMIT_L1, DEFAULT_GAS_L2 } from './constants'
export { relayL2ToL1Messages }

/**
 * Deposit Ether.
 *
 * @param bridgeAddress L1 bridge address.
 * @param depositAmount The amount to deposit in wei.
 * @param l1Provider L1 provider.
 * @param signer L1 transaction signer.
 * @returns Returns the transaction response containing metadata for the ETH deposit transaction.
 */
export const depositETH = async (
  bridgeAddress: string,
  depositAmount: BigNumber,
  l1Provider: ethers.providers.JsonRpcProvider,
  signer: ethers.Signer
): Promise<ethers.providers.TransactionResponse> => {
  const L1StandardBridgeInterface = new ethers.utils.Interface(L1StandardBridgeABI)
  const contract = new ethers.Contract(bridgeAddress, L1StandardBridgeInterface, l1Provider)
  const transactionResponse = await contract.connect(signer).depositETH(DEFAULT_GAS_L2, '0xFFFF', {
    value: depositAmount,
    gasLimit: ETH_GAS_LIMIT_L1,
  })

  return transactionResponse
}

/**
 * Deposit ERC20 token. The L1 token requires a mapped L2 token to be deployed.
 *
 * @param l1TokenAddress L1 address of the token to deposit.
 * @param l2TokenAddress L2 address of the mapped equivalent of the L1 token.
 * @param bridgeAddress L1 bridge address.
 * @param depositAmount The amount to deposit in wei.
 * @param l1Provider L1 provider.
 * @param signer L1 transaction signer.
 * @returns Returns the transaction response containing metadata for the ETH deposit transaction.
 */
export const depositERC20 = async (
  l1TokenAddress: string,
  l2TokenAddress: string,
  bridgeAddress: string,
  depositAmount: BigNumber,
  l1Provider: ethers.providers.JsonRpcProvider,
  signer: ethers.Signer
): Promise<ethers.providers.TransactionResponse> => {
  const L1StandardBridgeInterface = new ethers.utils.Interface(L1StandardBridgeABI)
  const contract = new ethers.Contract(bridgeAddress, L1StandardBridgeInterface, l1Provider)
  const transactionResponse = await contract
    .connect(signer)
    .depositERC20(l1TokenAddress, l2TokenAddress, depositAmount, DEFAULT_GAS_L2, '0x')

  return transactionResponse
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
export const initiateWithdrawal = async (
  l2TokenAddress: string,
  withdrawAmount: BigNumber,
  l2Provider: ethers.providers.JsonRpcProvider,
  signer: ethers.Signer
): Promise<ethers.providers.TransactionResponse> => {
  const L2StandardBridgeInterface = new ethers.utils.Interface(L2StandardBridgeABI)
  const contract = new ethers.Contract(predeploys.NVM_L2StandardBridge, L2StandardBridgeInterface, l2Provider)
  const transactionResponse = await contract.connect(signer).withdraw(l2TokenAddress, withdrawAmount, 0, '0x')

  return transactionResponse
}

export const finalizeWithdrawal = relayL2ToL1Messages
