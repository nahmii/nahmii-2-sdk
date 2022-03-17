import { ethers, BigNumber } from 'ethers'
import { expect, proxyquire, sinon } from './setup'
import { Transfer, TransfersOptions } from '@src/types'
import { predeploys } from '../dist'

describe('token-transfers', () => {
  let tokenTransfers

  const contractAddress = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  const accountAddress1 = '0xcafed00dcafed00dcafed00dcafed00dcafed00d'
  const accountAddress2 = '0xcafebabecafebabecafebabecafebabecafebabe'

  const l2Provider: ethers.providers.JsonRpcProvider = {} as ethers.providers.JsonRpcProvider

  const fromBlock: ethers.providers.BlockTag = 'some from block'
  const toBlock: ethers.providers.BlockTag = 'some to block'

  const senderEventFilter = 'some sender filter'
  const recipientEventFilter = 'some recipient filter'

  let senderEvents
  let recipientEvents
  let expectedTransfers: Transfer[]
  let queryFilter
  let TokenContract

  before(() => {
    proxyquire.noCallThru()
  })

  beforeEach(async () => {
    senderEvents = mockTransferEvents(accountAddress1, accountAddress2, 3)
    recipientEvents = mockTransferEvents(accountAddress2, accountAddress1, 2)

    const Interface = sinon.stub()

    queryFilter = sinon.stub()
    queryFilter.onFirstCall().resolves(senderEvents)
    queryFilter.onSecondCall().resolves(recipientEvents)

    const TransferFn = sinon.stub()
    TransferFn.withArgs(accountAddress1, undefined).returns(senderEventFilter)
    TransferFn.withArgs(undefined, accountAddress1).returns(recipientEventFilter)

    TokenContract = sinon.stub()
    TokenContract.prototype.queryFilter = queryFilter
    TokenContract.prototype.filters = {
      Transfer: TransferFn,
    }

    tokenTransfers = proxyquire('@src/token-transfers', {
      ethers: {
        ethers: {
          utils: { Interface },
          Contract: TokenContract,
        },
      },
    })
  })

  describe('transfersOfETH', () => {
    describe('with from and to block tags and options for transaction response and receipt', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          [...senderEvents, ...recipientEvents].map(async (ev) => {
            return transformEventToTransfer(ev, predeploys.NVM_ETH, {
              transactionResponse: true,
              transactionReceipt: true,
            })
          })
        )
      })

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfETH(accountAddress1, l2Provider, fromBlock, toBlock, {
          transactionResponse: true,
          transactionReceipt: true,
        })

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })
    })

    describe('without from and to block tags or options for transaction response and receipt', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          [...senderEvents, ...recipientEvents].map(async (ev) => {
            return transformEventToTransfer(ev, predeploys.NVM_ETH)
          })
        )
      })

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfETH(accountAddress1, l2Provider)

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, undefined, undefined)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, undefined, undefined)
      })
    })
  })

  describe('transfersOfERC20', () => {
    describe('with from and to block tags and options for transaction response and receipt', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          [...senderEvents, ...recipientEvents].map(async (ev) => {
            return transformEventToTransfer(ev, contractAddress, {
              transactionResponse: true,
              transactionReceipt: true,
            })
          })
        )
      })

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(
          contractAddress,
          accountAddress1,
          l2Provider,
          fromBlock,
          toBlock,
          {
            transactionResponse: true,
            transactionReceipt: true,
          }
        )

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })
    })

    describe('without from and to block tags or options for transaction response and receipt', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          [...senderEvents, ...recipientEvents].map(async (ev) => {
            return transformEventToTransfer(ev, contractAddress)
          })
        )
      })

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(contractAddress, accountAddress1, l2Provider)

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, undefined, undefined)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, undefined, undefined)
      })
    })
  })
})

type TransferEvent = {
  args: [string, string, BigNumber]
  getTransaction: () => any
  getTransactionReceipt: () => any
}

const mockTransferEvents = (sender: string, recipient: string, count: number, max: number = 100): TransferEvent[] => {
  const events: TransferEvent[] = new Array<TransferEvent>()

  for (let i = 0; i < count; i++) {
    const amount = BigNumber.from(Math.ceil(Math.random() * max))

    events.push({
      args: [sender, recipient, amount],
      getTransaction: async () => `response: ${amount.toString()} transferred from ${sender} to ${recipient}`,
      getTransactionReceipt: async () => `receipt: ${amount.toString()} transferred from ${sender} to ${recipient}`,
    })
  }

  return events
}

const transformEventToTransfer = async (
  event: TransferEvent,
  contractAddress: string,
  options?: TransfersOptions
): Promise<Transfer> => {
  const [sender, recipient, amount] = event.args as Array<any>
  const [transactionResponse, transactionReceipt] = await Promise.all([
    options && options.transactionResponse ? await event.getTransaction() : undefined,
    options && options.transactionReceipt ? await event.getTransactionReceipt() : undefined,
  ])

  const transfer = {
    contractAddress,
    sender,
    recipient,
    amount,
    transactionResponse,
    transactionReceipt,
  }

  return transfer
}
