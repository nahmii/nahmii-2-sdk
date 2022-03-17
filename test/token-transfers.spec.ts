import {ethers} from 'ethers'
import {expect, proxyquire, sinon} from './setup'
import {BigNumber} from 'ethers'
import {Transfer} from "@src/types";
import {predeploys} from "../dist";

describe('token-transfers', () => {

  let tokenTransfers;

  const l2TokenAddress = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const accountAddress1 = '0xcafed00dcafed00dcafed00dcafed00dcafed00d';
  const accountAddress2 = '0xcafebabecafebabecafebabecafebabecafebabe';

  const l2Provider: ethers.providers.JsonRpcProvider = <ethers.providers.JsonRpcProvider>{};

  const fromBlock: ethers.providers.BlockTag = 'some from block'
  const toBlock: ethers.providers.BlockTag = 'some to block'

  const senderEventFilter = 'some sender filter'
  const recipientEventFilter = 'some recipient filter'

  let expectedTransfers: Transfer[];
  let queryFilter;
  let TokenContract;

  before(() => {
    proxyquire.noCallThru()
  })

  beforeEach(async () => {
    const senderEvents = mockTransferEvents(accountAddress1, accountAddress2, 3)
    const recipientEvents = mockTransferEvents(accountAddress2, accountAddress1, 2)

    expectedTransfers = await Promise.all([...senderEvents, ...recipientEvents].map(transformEventToTransfer));

    const Interface = sinon.stub();

    queryFilter = sinon.stub()
    queryFilter.onFirstCall().resolves(senderEvents)
    queryFilter.onSecondCall().resolves(recipientEvents)

    const Transfer = sinon.stub()
    Transfer.withArgs(accountAddress1, undefined).returns(senderEventFilter)
    Transfer.withArgs(undefined, accountAddress1).returns(recipientEventFilter)

    TokenContract = sinon.stub();
    TokenContract.prototype.queryFilter = queryFilter
    TokenContract.prototype.filters = {
      Transfer
    }

    const ethers = {
      utils: {Interface},
      Contract: TokenContract
    }

    tokenTransfers = proxyquire("@src/token-transfers", {
      'ethers': {ethers}
    });
  })

  describe('transfersOfETH', () => {

    describe('with from and to block tags', () => {

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfETH(accountAddress1, l2Provider, fromBlock, toBlock)

        expect(TokenContract).to.have.been.calledWith(predeploys.NVM_ETH, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })

    })

    describe('without from and to block tags', () => {

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

    describe('with from and to block tags', () => {

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(l2TokenAddress, accountAddress1, l2Provider, fromBlock, toBlock)

        expect(TokenContract).to.have.been.calledWith(l2TokenAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, fromBlock, toBlock)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, fromBlock, toBlock)
      })

    })

    describe('without from and to block tags', () => {

      it('should retrieve the transfers', async () => {
        const transfers = await tokenTransfers.transfersOfERC20(l2TokenAddress, accountAddress1, l2Provider)

        expect(TokenContract).to.have.been.calledWith(l2TokenAddress, sinon.match.any, l2Provider)

        expect(transfers).to.deep.equal(expectedTransfers)
        expect(queryFilter).to.have.been.calledWith(senderEventFilter, undefined, undefined)
        expect(queryFilter).to.have.been.calledWith(recipientEventFilter, undefined, undefined)
      })

    })

  })

})

type TransferEvent = {
  args: [string, string, BigNumber],
  getTransactionReceipt: () => any
}

const mockTransferEvents = (sender: string, recipient: string, count: number, max: number = 100):
  TransferEvent[] => {
  const events: TransferEvent[] = new Array<TransferEvent>();

  for (let i = 0; i < count; i++) {
    const amount = BigNumber.from(Math.ceil(Math.random() * max));

    events.push({
      args: [sender, recipient, amount],
      getTransactionReceipt: async () => `receipt: ${amount.toString()} transferred from ${sender} to ${recipient}`
    })
  }

  return events;
}

const transformEventToTransfer = async (event: TransferEvent): Promise<Transfer> => {
  const [sender, recipient, amount] = event.args as Array<any>
  const transactionReceipt = await event.getTransactionReceipt()

  const transfer = {
    sender,
    recipient,
    amount,
    transactionReceipt
  }

  return transfer
}
