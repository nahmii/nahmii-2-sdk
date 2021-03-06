import { Wallet, ethers, BigNumber } from 'ethers'
import { finalizeWithdrawal, initiateWithdrawal } from '@src/bridge-tokens'

describe('bridge-tokens', () => {
  let txHash: string
  const l1CrossDomainMessengerAddress = '0x5401Ba2f9123f4019be76fca1D0B765Fd00138De'
  const l1RPCProvider = new ethers.providers.JsonRpcProvider('https://geth-ropsten.dev.hubii.net')
  const l2RPCProvider = new ethers.providers.JsonRpcProvider('https://l2.testnet.nahmii.io/')
  // TODO: Use .env to insert a wallet PK for testing.
  const l1Wallet = new Wallet('0xdead')

  xit('initiateWithdrawal', async () => {
    const l2TokenAddress = '0x4200000000000000000000000000000000000006'
    const withdrawAmount = BigNumber.from('1000000000000000000')
    const txResponse = await initiateWithdrawal(l2TokenAddress, withdrawAmount, l2RPCProvider, l1Wallet)
    const receipt = await txResponse.wait()
    console.log(receipt)
    // const receipt = (await result).wait()
    // console.log(receipt)
  })

  xit('finalizeWithdrawal', async () => {
    // TODO: Pass a withdraw transaction hash
    txHash = ''
    await finalizeWithdrawal(txHash, l1CrossDomainMessengerAddress, l1RPCProvider, l2RPCProvider, l1Wallet)
  }).timeout(300000)
})
