import { ethers, BigNumber } from 'ethers'
import { expect, proxyquire, sinon } from './setup'

describe('token-balances', () => {
  let tokenBalances

  const contractAddress = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  const accountAddress = '0xcafed00dcafed00dcafed00dcafed00dcafed00d'

  const l2Provider: ethers.providers.JsonRpcProvider = {} as ethers.providers.JsonRpcProvider

  const blockTag: ethers.providers.BlockTag = 'some block tag'

  const expectedBalance = BigNumber.from(42)

  let balanceOf

  before(() => {
    proxyquire.noCallThru()
  })

  beforeEach(() => {
    balanceOf = sinon.stub().resolves(expectedBalance)

    const Interface = sinon.stub()

    const Contract = sinon.stub()
    Contract.prototype.balanceOf = balanceOf

    tokenBalances = proxyquire('@src/token-balances', {
      ethers: {
        ethers: {
          utils: { Interface },
          Contract,
        },
      },
    })
  })

  describe('balanceOfETH', () => {
    describe('with block tag', () => {
      it('should retrieve the balance', async () => {
        const balance = await tokenBalances.balanceOfETH(accountAddress, l2Provider, blockTag)

        expect(balance).to.equal(expectedBalance)
        expect(balanceOf).to.have.been.calledWithExactly(accountAddress, { blockTag })
      })
    })

    describe('without block tag', () => {
      it('should retrieve the balance', async () => {
        const balance = await tokenBalances.balanceOfETH(accountAddress, l2Provider)

        expect(balance).to.equal(expectedBalance)
        expect(balanceOf).to.have.been.calledWithExactly(accountAddress, undefined)
      })
    })
  })

  describe('balanceOfERC20', () => {
    describe('with block tag', () => {
      it('should retrieve the balance', async () => {
        const balance = await tokenBalances.balanceOfERC20(contractAddress, accountAddress, l2Provider, blockTag)

        expect(balance).to.equal(expectedBalance)
        expect(balanceOf).to.have.been.calledWithExactly(accountAddress, { blockTag })
      })
    })

    describe('without block tag', () => {
      it('should retrieve the balance', async () => {
        const balance = await tokenBalances.balanceOfERC20(contractAddress, accountAddress, l2Provider)

        expect(balance).to.equal(expectedBalance)
        expect(balanceOf).to.have.been.calledWithExactly(accountAddress, undefined)
      })
    })
  })
})
