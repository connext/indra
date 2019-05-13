export interface Logger {
  source: string
  logToApi(key: string, data: any): Promise<void>
}
export default Logger
