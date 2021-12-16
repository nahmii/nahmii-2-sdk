import { expect } from './setup'
import { Wallet, ethers, BigNumber } from 'ethers'
import { relayXDomainMessages, withdraw } from '../src/proof'

describe('relay message', () => {
  let txHash: string
  const l1CrossDomainMessengerAddress =
    '0x5401Ba2f9123f4019be76fca1D0B765Fd00138De'
  const l1RPCProvider = new ethers.providers.JsonRpcProvider(
    'https://geth-ropsten.dev.hubii.net'
  )
  const l2RPCProvider = new ethers.providers.JsonRpcProvider(
    'https://l2.testnet.nahmii.io/'
  )
  const l1Wallet = new Wallet(
    ''
  )

  it('initialize withdrawal on L2', async () => {
    const l2TokenAddress = '0x4200000000000000000000000000000000000006'
    const withdrawAmount = BigNumber.from('1000000000000000000')
    const result = withdraw(
      l2TokenAddress,
      withdrawAmount,
      l2RPCProvider,
      l1Wallet
    )
    await result
    console.log(result)
    // const receipt = (await result).wait()
    // console.log(receipt)
  })

  it.only('should relay message', async () => {
    txHash =
      ''
    await relayXDomainMessages(
      txHash,
      l1CrossDomainMessengerAddress,
      l1RPCProvider,
      l2RPCProvider,
      l1Wallet
    )
  }).timeout(300000)
})
