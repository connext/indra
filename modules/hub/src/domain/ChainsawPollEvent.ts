export default interface ChainsawPollEvent {
  blockNumber: number,
  txIndex: number|null
  polledAt: number,
  contract: string
}
