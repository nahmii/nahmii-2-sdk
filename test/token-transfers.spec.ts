import { ethers, BigNumber } from 'ethers'
import { expect, proxyquire, sinon } from './setup'
import { ERC20Transfer, ERC20TransfersOptions } from '@src/types'
import { predeploys } from '../dist'

describe('token-transfers', () => {
  let tokenTransfers

  const contractAddress = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  const accountAddress1 = '0xcafed00dcafed00dcafed00dcafed00dcafed00d'
  const accountAddress2 = '0xcafebabecafebabecafebabecafebabecafebabe'

  const l2Provider: ethers.providers.JsonRpcProvider = {} as ethers.providers.JsonRpcProvider
  const l2Signer: ethers.Signer = {} as ethers.Signer

  const fromBlock: ethers.providers.BlockTag = 'some from block'
  const toBlock: ethers.providers.BlockTag = 'some to block'

  const senderEventFilter = 'some sender filter'
  const recipientEventFilter = 'some recipient filter'

  const gasPrice = ethers.utils.parseUnits('0.015', 'gwei')

  let senderEvents
  let recipientEvents
  let expectedTransfers: ERC20Transfer[]
  let queryFilter
  let TokenContract
  let transferFn

  before(() => {
    proxyquire.noCallThru()
  })

  beforeEach(async () => {
    senderEvents = mockTransferEvents(accountAddress1, accountAddress2, 3)
    recipientEvents = mockTransferEvents(accountAddress2, accountAddress1, 2)

    const Interface = sinon.stub()

    queryFilter = sinon.stub()
    queryFilter.withArgs(senderEventFilter).resolves(senderEvents)
    queryFilter.withArgs(recipientEventFilter).resolves(recipientEvents)

    const TransferFilterFn = sinon.stub()
    TransferFilterFn.withArgs(accountAddress1, undefined).returns(senderEventFilter)
    TransferFilterFn.withArgs(undefined, accountAddress1).returns(recipientEventFilter)

    transferFn = sinon.stub()

    TokenContract = sinon.stub()
    TokenContract.prototype.queryFilter = queryFilter
    TokenContract.prototype.filters = {
      Transfer: TransferFilterFn,
    }
    TokenContract.prototype.transfer = transferFn

    tokenTransfers = proxyquire('@src/token-transfers', {
      ethers: {
        ethers: {
          utils: { Interface, parseUnits: ethers.utils.parseUnits },
          Contract: TokenContract,
          BigNumber,
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

    describe('with option.isSender being false', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          recipientEvents.map(async (ev) => {
            return transformEventToTransfer(ev, predeploys.NVM_ETH)
          })
        )
      })

      it('should retrieve only the transfers where the given account is recipient', async () => {
        const transfers = await tokenTransfers.transfersOfETH(accountAddress1, l2Provider, fromBlock, toBlock, {
          isSender: false,
        })

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.not.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })
    })

    describe('with option.isRecipient being false', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          senderEvents.map(async (ev) => {
            return transformEventToTransfer(ev, predeploys.NVM_ETH)
          })
        )
      })

      it('should retrieve only the transfers where the given account is sender', async () => {
        const transfers = await tokenTransfers.transfersOfETH(accountAddress1, l2Provider, fromBlock, toBlock, {
          isRecipient: false,
        })

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.not.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
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

    describe('with option.isSender being false', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          recipientEvents.map(async (ev) => {
            return transformEventToTransfer(ev, contractAddress)
          })
        )
      })

      it('should retrieve only the transfers where the given account is recipient', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(
          contractAddress,
          accountAddress1,
          l2Provider,
          fromBlock,
          toBlock,
          {
            isSender: false,
          }
        )

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.not.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })
    })

    describe('with option.isRecipient being false', () => {
      beforeEach(async () => {
        expectedTransfers = await Promise.all(
          senderEvents.map(async (ev) => {
            return transformEventToTransfer(ev, contractAddress)
          })
        )
      })

      it('should retrieve only the transfers where the given account is sender', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(
          contractAddress,
          accountAddress1,
          l2Provider,
          fromBlock,
          toBlock,
          {
            isRecipient: false,
          }
        )

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.not.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })
    })
  })

  describe('transferETH', () => {
    const txResponse = {} as ethers.providers.TransactionResponse
    const amount = '123'

    beforeEach(() => {
      txResponse.wait = sinon.stub()
      transferFn.resolves(txResponse)
    })

    describe('without overrides argument', () => {
      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferETH(accountAddress1, amount, l2Signer)

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          gasPrice,
        })
        expect(txResponse.wait).to.not.have.been.called
        expect(result).to.equal(txResponse)
      })
    })

    describe('with explicit intent to not wait for transaction being mined', () => {
      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferETH(accountAddress1, amount, l2Signer, {
          wait: false,
        })

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          wait: false,
          gasPrice,
        })
        expect(txResponse.wait).to.not.have.been.called
        expect(result).to.equal(txResponse)
      })
    })

    describe('with explicit intent to wait for transaction being mined', () => {
      const txReceipt = {} as ethers.providers.TransactionReceipt

      beforeEach(async () => {
        ;(txResponse.wait as any).resolves(txReceipt)
      })

      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferETH(accountAddress1, amount, l2Signer, {
          wait: true,
        })

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          wait: true,
          gasPrice,
        })
        expect(txResponse.wait).to.have.been.called
        expect(result).to.equal(txReceipt)
      })
    })
  })

  describe('transferERC20', () => {
    const txResponse = {} as ethers.providers.TransactionResponse
    const amount = '123'

    beforeEach(() => {
      txResponse.wait = sinon.stub()
      transferFn.resolves(txResponse)
    })

    describe('without overrides argument', () => {
      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferERC20(contractAddress, accountAddress1, amount, l2Signer)

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          gasPrice,
        })
        expect(txResponse.wait).to.not.have.been.called
        expect(result).to.equal(txResponse)
      })
    })

    describe('with explicit intent to not wait for transaction being mined', () => {
      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferERC20(contractAddress, accountAddress1, amount, l2Signer, {
          wait: false,
        })

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          wait: false,
          gasPrice,
        })
        expect(txResponse.wait).to.not.have.been.called
        expect(result).to.equal(txResponse)
      })
    })

    describe('with explicit intent to wait for transaction being mined', () => {
      const txReceipt = {} as ethers.providers.TransactionReceipt

      beforeEach(async () => {
        ;(txResponse.wait as any).resolves(txReceipt)
      })

      it('should transfer ERC20 and not wait for transaction to be mined', async () => {
        const result = await tokenTransfers.transferERC20(contractAddress, accountAddress1, amount, l2Signer, {
          wait: true,
        })

        expect(TokenContract).to.have.been.calledWith(contractAddress, sinon.match.any, l2Signer)
        expect(transferFn).to.have.been.calledWith(accountAddress1, ethers.BigNumber.from(amount), {
          wait: true,
          gasPrice,
        })
        expect(txResponse.wait).to.have.been.called
        expect(result).to.equal(txReceipt)
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
  options?: ERC20TransfersOptions
): Promise<ERC20Transfer> => {
  const [sender, recipient, amount] = event.args as Array<any>
  const [transactionResponse, transactionReceipt] = await Promise.all([
    options && options.transactionResponse ? await event.getTransaction() : undefined,
    options && options.transactionReceipt ? await event.getTransactionReceipt() : undefined,
  ])

  return {
    contractAddress,
    sender,
    recipient,
    amount,
    transactionResponse,
    transactionReceipt,
  }
}
