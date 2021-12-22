import { BigNumber, ethers } from 'ethers'
import { predeploys } from './predeploys'
import L2StandardBridgeMetadata from '@contracts/NVM_L2StandardBridge.json'

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
  const L2StandardBridgeInterface = new ethers.utils.Interface(L2StandardBridgeMetadata.abi)
  const contract = new ethers.Contract(predeploys.NVM_L2StandardBridge, L2StandardBridgeInterface, l2Provider)
  const signerWithProvider = signer.connect(l2Provider)
  const transactionResponse = await contract
    .connect(signerWithProvider)
    .withdraw(l2TokenAddress, withdrawAmount, 0, '0x')

  return transactionResponse
}
