export interface Transaction {
    hash: string;
    nonce: number;
    blockHash: string | null;
    blockNumber: number | null;
    transactionIndex: number | null;
    from: string;
    to: string;
    value: string;
    gasPrice: string;
    gas: number;
    input: string;
}

export interface BlockHeader {
    number: number
    hash: string
    parentHash: string
    nonce: string
    sha3Uncles: string
    logsBloom: string
    transactionRoot: string
    stateRoot: string
    receiptRoot: string
    miner: string
    extraData: string
    gasLimit: number
    gasUsed: number
    timestamp: number
}

export interface Block extends BlockHeader {
    transactions: Transaction[];
    size: number
    difficulty: number
    totalDifficulty: number
    uncles: string[];
}

export type TransactionMeta = Partial<{
  reason: string
  contract: string
  method: string
  args: any
  // If provided, the complete callback should be in the form
  // "ServiceName.method", and that method will be called when the transaction
  // completes (ie, is confirmed or failed).
  completeCallback: string
}>

export type TransactionRequest = {
  logicalId?: number
  from: string
  to: string
  data?: string
  value?: string
  gas?: number
  meta?: TransactionMeta
}

export type RawTransaction = {
  from: string
  to: string
  value: string
  gas: number
  gasPrice: string
  data: string
  nonce: number
}

export type UnconfirmedTransaction = {
  from: string
  to: string
  value: string
  gas: number
  gasPrice: string
  data: string
  nonce: number
  signature: {
    r: string
    s: string
    v: number
  }
  hash: string
}

export type ConfirmedTransaction = UnconfirmedTransaction & {
  blockNum: number | null
  blockHash: string | null
  transactionIndex: string | null
}

export type OnchainTransactionState = 'new' | 'submitted' | 'confirmed' | 'pending_failure' | 'failed'

export type OnchainTransactionRow = {
  id: number
  logicalId: number
  state: OnchainTransactionState
  createdOn: Date
  submittedOn: Date | null
  confirmedOn: Date | null
  meta: TransactionMeta
} & ConfirmedTransaction & {
  failedOn: Date | null
  failedReason: string | null
} & {
  pendingFailureOn: Date | null
}
