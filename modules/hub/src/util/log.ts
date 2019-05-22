import * as express from 'express'
import * as LogDNALogger from 'logdna'

import { prettySafeJson } from '.'

const levels: any = { 'debug': 10, 'info': 20, 'warn': 30, 'error': 40 }
const logLevelLimit = parseInt(process.env.LOG_LEVEL, 10) || 20

export interface ILogger {
  debug(msgFmt: string, meta?: object): void
  error(msgFmt: string, meta?: object): void
  info(msgFmt: string, meta?: object): void
  setDefaultMeta(meta: object): any
  warn(msgFmt: string, meta?: object): void
}

export function getLogger(name: string, app: string = 'indra-hub'): ILogger {
  return new Logger(app, name || app, process.env.SC_LOGDNA_KEY)
}

export const mockLogger: ILogger = ({
  debug: (msgFmt: string, meta?: object): void => undefined,
  error: (msgFmt: string, meta?: object): void => undefined,
  info: (msgFmt: string, meta?: object): void => undefined,
  setDefaultMeta: (meta: object): any => undefined,
  warn: (msgFmt: string, meta?: object): void => undefined,
})

export const logApiRequestError = (log: ILogger, req: express.Request): void => {
  log.warn(
    `Received invalid request parameters. Aborting. ` +
    `Params received: ${JSON.stringify(req.params)}, ` +
    `Body received: ${JSON.stringify(req.body)}, ` +
    `Query received: ${JSON.stringify(req.query)}`)
}

export class Logger implements ILogger {
  private logdna: any
  private name: string
  private defaultMeta: object

  public constructor(app: string, name: string, key?: string) {
    if (key) {
      this.logdna = LogDNALogger.createLogger(key, {
        app,
        index_meta: true,
      })
    }
    this.name = name
    this.defaultMeta = {
      env: process.env.NODE_ENV || 'local',
    }
  }

  public error(msgFmt: string, meta?: object): void {
    this.log('error', msgFmt, meta)
  }

  public warn(msgFmt: string, meta?: object): void {
    this.log('warn', msgFmt, meta)
  }

  public info(msgFmt: string, meta?: object): void {
    this.log('info', msgFmt, meta)
  }

  public debug(msgFmt: string, meta?: object): void {
    this.log('debug', msgFmt, meta)
  }

  public setDefaultMeta(meta: object): any {
    this.defaultMeta = { ...this.defaultMeta, ...meta }
    return this
  }

  private log(level: string, msgFmt: any, meta?: any): void {

    const lookup = (data: object, expression: string): object => {
      const exp: string[] = expression.split('.')
      let retVal: any = data
      do {
        retVal = retVal[exp.shift() as string]
      } while (retVal && exp.length)
      return retVal as object
    }

    let fmt: string|undefined
    if (meta === undefined && typeof msgFmt !== 'string') {
      meta = msgFmt
      fmt = undefined
    } else {
      fmt = msgFmt
    }

    meta = Object.assign({}, meta || {}, this.defaultMeta)
    let levelno = levels[level] || 0
    let msg = fmt && fmt.replace(/{(.*?)}/g, (_: string, field: any): any => {
      field = field.replace(/^\s*(.*?)\s*$/, '$1')
      let val = lookup(meta!, field)
      return val === undefined ? `{${field}}` : this.renderVal(val)
    })

    let toLog = Object.assign({
      level,
      levelno,
      name: this.name,
      message: msg,
    }, meta)

    if ((process.env.NODE_ENV !== 'production' || !this.logdna) && levelno >= logLevelLimit) {
      // Make those warnings really POP
      level = (level === 'warn' || level === 'error') ? level.toUpperCase() : level
      ;(console[level] || console.log)(`${level}: ${msg || this.name}`)
    }

    if (this.logdna) {
      this.logdna[level](toLog)
    }
  }

  private renderVal(val: any): string {
    if (val instanceof Error) {
      return `${val.message}\n${val.stack}`
    }
    return prettySafeJson(val)
  }

}

export default getLogger
