export default interface ExchangeRate {
  id: number
  retrievedAt: number
  base: string
  rates: {
    [k: string]: string
  }
}
