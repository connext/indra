export default interface Logger {
  source: string
  logToApi(key: string, data: any): Promise<void>
}
