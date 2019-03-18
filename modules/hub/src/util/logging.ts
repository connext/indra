import { prettySafeJson } from ".";

const logLevelLimit = parseInt(process.env.LOG_LEVEL, 10) || 20

/*

Logs messages to both the console and logdna!

Usage:

  let getLogger = require('.../logging');

  let log = getLogger('api-server').setDefaultMeta({
    someDefaultMetadata: 42,
  });

  log.info('Request from: {request.ip}', {
    request: {
      ip: '1.2.3.4',
    },
  });

*/

let LogDNALogger = require('logdna')

const levels: any = {
  'error': 40,
  'warn': 30,
  'info': 20,
  'debug': 10,
}

function lookup(data: object, expression: string): object {
  let exp: string[] = expression.split('.')
  let retVal: any = data
  do {
    retVal = retVal[exp.shift() as string]
  } while (retVal && exp.length)

  return retVal as object
}

export class SCLogger {
  logdna: any

  name: string

  defaultMeta: object

  constructor(app: string, name: string, key?: string) {
    if (key) {
      this.logdna = LogDNALogger.createLogger(key, {
        index_meta: true,
        app,
      })
    }

    this.name = name
    this.defaultMeta = {
      env: process.env.NODE_ENV || 'local',
    }
  }

  setDefaultMeta(meta: object) {
    this.defaultMeta = Object.assign(this.defaultMeta, meta)
    return this
  }

  log(level: string, msgFmt: any, meta?: any) {
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

    const c = console as any

    if ((process.env.NODE_ENV !== 'production' || !this.logdna) && levelno >= logLevelLimit) {
      (c[level] || console.log)(`${level}: ${msg || this.name}`)
    }

    if (this.logdna) {
      this.logdna[level](toLog)
    }
  }

  error(msgFmt: string, meta?: object) {
    this.log('error', msgFmt, meta)
  }

  warn(msgFmt: string, meta?: object) {
    this.log('warn', msgFmt, meta)
  }

  warning(msgFmt: string, meta?: object) {
    this.log('warn', msgFmt, meta)
  }

  info(msgFmt: string, meta?: object) {
    this.log('info', msgFmt, meta)
  }

  debug(msgFmt: string, meta?: object) {
    this.log('debug', msgFmt, meta)
  }

  private renderVal(val: any): any {
    if (val instanceof Error) {
      return `${val.message}\n${val.stack}`
    }

    return prettySafeJson(val)
  }
}

/*
 * See top of file for usage!
 */
export default function getLogger(app: string, name: string) {
  return new SCLogger(app, name || app, process.env.SC_LOGDNA_KEY)
}
