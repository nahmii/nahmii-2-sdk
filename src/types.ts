import { ethers } from 'ethers'
export type Input = Buffer | string | number | bigint | Uint8Array | List | null

// Use interface extension instead of type alias to
// make circular declaration possible.
export interface List extends Array<Input> {}

export interface Decoded {
  data: Buffer | Buffer[]
  remainder: Buffer
}

export interface ERC20Transfer {
  contractAddress: string
  sender: string
  recipient: string
  amount: number
  transactionResponse?: ethers.providers.TransactionResponse
  transactionReceipt?: ethers.providers.TransactionReceipt
}

export interface ERC20TransfersOptions {
  transactionResponse?: boolean
  transactionReceipt?: boolean
  isSender?: boolean
  isRecipient?: boolean
}

export interface Overrides extends ethers.Overrides {
  wait?: boolean
}
