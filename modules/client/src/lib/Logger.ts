export interface LoggerOptions {
  source: string
  method?: string
  getAddress: () => Promise<string>
}

export interface Metric {
  name: string
  ts: Date
  data: any
}

export default interface Logger {
  source: string
  logToApi (metrics: Array<Metric>): Promise<void>
}
