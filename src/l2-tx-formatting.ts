import cloneDeep from 'lodash/cloneDeep'
import { providers } from 'ethers'

/**
 * Helper for adding additional L2 context to transactions
 */
export const setTxOptionsForL2 = (provider: providers.JsonRpcProvider): providers.JsonRpcProvider => {
  const extProvider = cloneDeep(provider)

  // Pass through the state root
  const blockFormat = extProvider.formatter.block.bind(extProvider.formatter)
  extProvider.formatter.block = (block) => {
    const b = blockFormat(block)
    b.stateRoot = block.stateRoot
    return b
  }

  // Pass through the state root and additional tx data
  const blockWithTransactions = extProvider.formatter.blockWithTransactions.bind(extProvider.formatter)
  extProvider.formatter.blockWithTransactions = (block) => {
    const b = blockWithTransactions(block)
    b.stateRoot = block.stateRoot
    for (let i = 0; i < b.transactions.length; i++) {
      b.transactions[i].l1BlockNumber = block.transactions[i].l1BlockNumber
      if (b.transactions[i].l1BlockNumber != null) {
        b.transactions[i].l1BlockNumber = parseInt(b.transactions[i].l1BlockNumber, 16)
      }
      b.transactions[i].l1Timestamp = block.transactions[i].l1Timestamp
      if (b.transactions[i].l1Timestamp != null) {
        b.transactions[i].l1Timestamp = parseInt(b.transactions[i].l1Timestamp, 16)
      }
      b.transactions[i].l1TxOrigin = block.transactions[i].l1TxOrigin
      b.transactions[i].queueOrigin = block.transactions[i].queueOrigin
      b.transactions[i].rawTransaction = block.transactions[i].rawTransaction
    }
    return b
  }

  // Handle additional tx data
  const formatTxResponse = extProvider.formatter.transactionResponse.bind(extProvider.formatter)
  extProvider.formatter.transactionResponse = (transaction) => {
    const tx = formatTxResponse(transaction) as any
    tx.txType = transaction.txType
    tx.queueOrigin = transaction.queueOrigin
    tx.rawTransaction = transaction.rawTransaction
    tx.l1BlockNumber = transaction.l1BlockNumber
    tx.l1Timestamp = transaction.l1Timestamp
    if (tx.l1BlockNumber != null) {
      tx.l1BlockNumber = parseInt(tx.l1BlockNumber, 16)
    }
    if (tx.l1Timestamp != null) {
      tx.l1Timestamp = parseInt(tx.l1Timestamp, 16)
    }
    tx.l1TxOrigin = transaction.l1TxOrigin
    return tx
  }

  const formatReceiptResponse = extProvider.formatter.receipt.bind(extProvider.formatter)
  extProvider.formatter.receipt = (value) => {
    const receipt = formatReceiptResponse(value) as any
    receipt.nvmTransactionHash = value.nvmTransactionHash
    receipt.operatorSignature = value.operatorSignature
    return receipt
  }

  return extProvider
}

export const formatNVMTx = (l2Tx) => {
  return {
    timestamp: l2Tx.l1Timestamp,
    blockNumber: l2Tx.l1BlockNumber,
    l1QueueOrigin: l2Tx.queueOrigin === 'sequencer' ? 0 : 1,
    l1TxOrigin: l2Tx.l1TxOrigin || '0x0000000000000000000000000000000000000000',
    entrypoint: '0x4200000000000000000000000000000000000005',
    gasLimit: '11000000',
    data: l2Tx.rawTransaction,
  }
}

export const formatNVMReceipt = (l2Receipt) => {
  return {
    index: l2Receipt.blockNumber,
    stateRoot: l2Receipt.root,
    nvmTransactionHash: l2Receipt.nvmTransactionHash,
    operatorSignature: l2Receipt.operatorSignature || '0x' + '0'.repeat(64),
  }
}
