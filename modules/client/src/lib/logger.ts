export interface ILogger {
  source: string
  logToApi(key: string, data: any): Promise<void>
}
export default ILogger
