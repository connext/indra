export default interface GasEstimate {
  retrievedAt: number

  speed: number
  blockNum: number
  blockTime: number

  fastest: number
  fastestWait: number

  fast: number
  fastWait: number

  average: number
  avgWait: number

  safeLow: number
  safeLowWait: number
}
