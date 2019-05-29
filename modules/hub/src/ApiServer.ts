import * as cors from 'cors'
import * as express from 'express'
import https from 'https'
import selfsigned from 'selfsigned'
import * as WebSocket from 'ws'

import { ApiService } from './api/ApiService'
import Config from './Config'
import { Container } from './Container'
import { getAuthMiddleware } from './middleware/AuthMiddleware'
import { ezPromise, Logger, maybe, MaybeRes } from './util'

const log = new Logger('ApiServer')
const requestLog = new Logger('requests')

const requestLogMiddleware = (
  req: express.Request,
  res: express.Response,
  next: () => any,
): void => {
  const startTime = Date.now()
  res.on('finish', () => {
    const remoteAddr =
      req.ip || req.headers['x-forwarded-for'] || (req as any).address
    const duration = Date.now() - startTime
    requestLog.info(
      `${remoteAddr} ${req.method} ${req.originalUrl} ${req.get('content-length') || '0'} bytes` +
      ` -> ${res.statusCode} (${res.get('content-length') || '?'} bytes; ` +
      `${(duration / 1000).toFixed(3)} ms)`)
  })
  next()
}

/**
 * Adds `getText(): Promise<string>` and `getRawBody(): Promise<Buffer>`
 * methods to `req`. They will reject if no content-length is provided,
 * or the content-length > maxSize.
 */
function bodyTextMiddleware(opts: { maxSize: number }): any {
  return (
    req: express.Request,
    res: express.Response,
    next: () => any,
  ): any => {
    const rawPromise = ezPromise<MaybeRes<Buffer>>()
    const textPromise = ezPromise<MaybeRes<string>>()

    req.getRawBody = (): any => maybe.unwrap(rawPromise.promise)
    req.getText = (): any => maybe.unwrap(textPromise.promise)

    const size = +req.headers['content-length']
    if (size > opts.maxSize) {
      const msg =
        size > opts.maxSize
          ? `bodyTextMiddleware: body too large (${size} > ${
              opts.maxSize
            }); not parsing.`
          : `bodyTextMiddleware: no content-length; not parsing body.`
      log.debug(msg)
      const rej = maybe.reject(new Error(msg))
      rawPromise.resolve(rej as any)
      textPromise.resolve(rej as any)
      return next()
    }

    const rawData = Buffer.alloc(size)
    let offset = 0
    req.on('data', (chunk: Buffer) => {
      log.debug(`Data! max size: ${opts.maxSize}`)
      chunk.copy(rawData, offset)
      offset += chunk.length
    })
    req.on('end', () => {
      // Assume UTF-8 because there's no easy way to get the correct charset ¯\_(ツ)_/¯
      rawPromise.resolve(maybe.accept(rawData))
      textPromise.resolve(maybe.accept(rawData.toString('utf8')))
    })
    return next()
  }
}

const logErrors = (
  err: any,
  req: express.Request,
  res: express.Response,
  next: any,
): void => {
  if (res.headersSent) {
    return next(err)
  }
  res.status(500)
  res.json({
    error: true,
    msg: err.message,
    reason: 'Unknown Error',
    stack: err.stack,
  })
  log.error(`Unknown error in ${req.method} ${req.path}: ${err.message}`)
}

export class ApiServer {
  public app: express.Application
  private log: Logger
  private readonly config: Config
  private readonly apiServices: ApiService[]

  public constructor(protected readonly container: Container) {
    this.config = container.resolve('Config')
    this.log = new Logger('ApiServer', this.config.logLevel)
    const corsHandler = cors({ credentials: true, origin: true })
    const apiServiceClasses = container.resolve('ApiServerServices') as any[]
    this.apiServices = apiServiceClasses.map(
      (cls: any): any => new cls(this.container),
    )

    this.app = express()
    this.app.options('*', corsHandler)

    // Start constructing API pipeline
    this.app.use(requestLogMiddleware)
    this.app.use(corsHandler)
    this.app.use(getAuthMiddleware(this.config))
    this.app.use(express.json())
    this.app.use(bodyTextMiddleware({ maxSize: 1024 * 1024 * 10 }))
    this.app.use(express.urlencoded({ extended: false }))
    this.app.use(logErrors.bind(this))
    this.apiServices.forEach(
      (s: any): any => {
        this.log.info(`Setting up API service at /${s.namespace}`)
        this.app.use(`/${s.namespace}`, s.getRouter())
      },
    )
    // Done constructing API pipeline
  }

  public async start(): Promise<void> {
    return new Promise((resolve: any): void => {
      let port = this.config.port
      let server: any = this.app

      if (this.config.forceSsl) {
        const pems = selfsigned.generate(
          [{ name: 'commonName', value: 'localhost' }],
          { days: 365, keySize: 4096 },
        )
        port = this.config.httpsPort
        server = https.createServer({ key: pems.private, cert: pems.cert }, this.app)
      }

      const wsPort = port + 1
      const wsServer = new WebSocket.Server({ port: wsPort })
      wsServer.on('connection', (ws: WebSocket): void => {
        this.log.info(`New WS connection established`)
        ws.on('message', (message: any): void => {
          this.log.info(`WS received message: [${typeof message}] ${message}`)
        })
        const toSend = `Hello WS client, I'm the hub`
        this.log.info(`WS sending message: [${typeof toSend}] ${toSend}`)
        ws.send(toSend)
      })

      server.listen(port, (err: any): void => {
        if (err) throw err
        this.log.info(`Listening on port: ${port}.`)
        resolve()
      })

    })
  }

}
