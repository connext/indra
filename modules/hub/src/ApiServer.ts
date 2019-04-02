import { MaybeRes } from './util'
import { ezPromise, maybe } from './util'
import Config from './Config'
import * as express from 'express'
import * as session from 'express-session'
import * as cookie from 'cookie-parser'
import log from './util/log'
import { Container } from './Container'
import { ApiService } from './api/ApiService'
import {
  default as AuthHandler,
  DefaultAuthHandler,
} from './middleware/AuthHandler'
import AuthHeaderMiddleware from './middleware/AuthHeaderMiddleware'
import * as path from 'path'
import * as cors from 'cors'

const LOG = log('ApiServer')
const SESSION_LOG = log('ConnectRedis')

const COOKIE_NAME = 'hub.sid'

const RedisStore = require('connect-redis')(session)

const requestLog = log('requests')
const requestLogMiddleware = (req: any, res: any, next: any): any => {
  req._startTime = Date.now()
  res.on('finish', () => {
    const remoteAddr = req.ip || req.headers['x-forwarded-for'] || req.address
    let duration = Date.now() - req._startTime
    requestLog.info('{remoteAddr} {method} {url} {inSize} -> {statusCode} ({outSize}; {duration})', {
      remoteAddr,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      inSize: (req.get('content-length') || '0') + ' bytes',
      outSize: (res.get('content-length') || '?') + ' bytes',
      duration: (duration / 1000).toFixed(3) + 'ms',
    })
  })
  next()
}

/**
 * Adds `getText(): Promise<string>` and `getRawBody(): Promise<Buffer>`
 * methods to `req`. They will reject if no content-length is provided,
 * or the content-length > maxSize.
 */
function bodyTextMiddleware(opts: { maxSize: number }) {
  return (req, res, next) => {
    const rawPromise = ezPromise<MaybeRes<Buffer>>()
    const textPromise = ezPromise<MaybeRes<string>>()

    req.getRawBody = () => maybe.unwrap(rawPromise.promise)
    req.getText = () => maybe.unwrap(textPromise.promise)

    const size = +req.headers['content-length']
    if (size != size || size > opts.maxSize) {
      const msg = (
        size > opts.maxSize ?
          `bodyTextMiddleware: body too large (${size} > ${opts.maxSize}); not parsing.` :
          `bodyTextMiddleware: no content-length; not parsing body.`
      )
      LOG.debug(msg)
      const rej = maybe.reject(new Error(msg))
      rawPromise.resolve(rej as any)
      textPromise.resolve(rej as any)
      return next()
    }

    const rawData = Buffer.alloc(size)
    let offset = 0
    req.on('data', (chunk: Buffer) => {
      LOG.debug(`Data! max size: ${opts.maxSize}`)
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

export class ApiServer {
  app: express.Application

  config: Config
  container: Container
  authHandler: AuthHandler
  apiServices: ApiService[]

  constructor(container: Container) {
    this.container = container
    this.config = container.resolve('Config')
    this.authHandler = this.container.resolve('AuthHandler')

    this.app = express()
    this.app.use(requestLogMiddleware)

    const corsHandler = cors({
      origin: true,
      credentials: true,
    })
    this.app.options('*', corsHandler)
    this.app.use(corsHandler)

    this.app.use(cookie())
    this.app.use(express.json())
    this.app.use(
      new AuthHeaderMiddleware(COOKIE_NAME, this.config.sessionSecret)
        .middleware,
    )
    this.app.use(
      session({
        secret: this.config.sessionSecret,
        name: COOKIE_NAME,
        resave: false,
        store: new RedisStore({
          url: this.config.redisUrl,
          logErrors: (err: any) =>
            SESSION_LOG.error('Encountered error in Redis session: {err}', {
              err,
            }),
        }),
        cookie: {
          httpOnly: true,
        },
      }),
    )

    // Note: this needs to come before the `express.json()` middlware, but
    // after the session middleware. I have no idea why, but if it's before the
    // session middleware requests hang, and the `express.json()` middleware
    // reads and exhausts the body, so we can't go after that one.
    this.app.use(bodyTextMiddleware({ maxSize: 1024 * 1024 * 10 }))

    this.app.use(express.urlencoded())

    this.app.use(this.authenticateRoutes.bind(this))
    this.app.use(this.logErrors.bind(this))

    const apiServiceClasses = container.resolve('ApiServerServices') as any[]
    this.apiServices = apiServiceClasses.map(cls => new cls(this.container))
    this.setupRoutes()
  }

  public async start() {
    return new Promise(resolve =>
      this.app.listen(this.config.port, () => {
        LOG.info(`Listening on port ${this.config.port}.`)
        resolve()
      }),
    )
  }

  private setupRoutes() {
    this.apiServices.forEach(s => {
      LOG.info(`Setting up API service at /${s.namespace}`)
      this.app.use(`/${s.namespace}`, s.getRouter())
    })
  }

  protected async authenticateRoutes(
    req: express.Request,
    res: express.Response,
    next: () => void,
  ) {
    const roles = await this.authHandler.rolesFor(req)
    req.session!.roles = new Set(roles)
    const allowed = await this.authHandler.isAuthorized(req)

    if (!allowed) {
      return res.sendStatus(403)
    }

    next()
  }

  private logErrors(
    err: any,
    req: express.Request,
    res: express.Response,
    next: any,
  ) {
    if (res.headersSent) {
      return next(err)
    }

    res.status(500)
    res.json({
      error: true,
      reason: 'Unknown Error',
      msg: err.message,
      stack: err.stack,
    })

    LOG.error('Unknown error in {req.method} {req.path}: {message}', {
      message: err.message,
      stack: err.stack,
      req: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
      },
    })
  }
}

