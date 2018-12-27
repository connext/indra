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

const requestLogMiddleware = (req: any, res: any, next: any): any => {
  req._startTime = Date.now()
  console.log('\n')
  log('requests').info('<==IN {remoteAddr} {method} {url}\nHeaders: {reqHeaders}\nQuery: {query}\nBody: {body}\nCookies: {cookies}', {
    remoteAddr: req.ip,
    method: req.method,
    url: req.originalUrl,
    reqHeaders: JSON.stringify(req.headers,null,2) || 'empty headers',
    query: JSON.stringify(req.query,null,2) || 'empty query',
    body: JSON.stringify(req.body,null,2) || 'empty body',
    cookies: JSON.stringify(req.cookies,null,2) || 'empty cookies',
  })
  res.on('finish', () => {
    let duration = Date.now() - req._startTime
    log('responses').info('OUT==> {remoteAddr} {method} {url} -> {statusCode} ({size} bytes; {duration})\n', {
      remoteAddr: req.ip,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      size: res.get('content-length') || '?',
      duration: (duration / 1000).toFixed(3),
    })
  })
  next()
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
    this.app.use(cookie())
    this.app.use(express.json())
    this.app.use(requestLogMiddleware)

    const corsHandler = cors({
      origin: true,
      credentials: true,
    })

    this.app.options('*', corsHandler)
    this.app.use(corsHandler)

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

    // TODO: This can probably be removed
    this.app.use(
      '/assets',
      express.static(path.join(__dirname, '../', 'public')),
    )
    this.app.use(this.authenticateRoutes.bind(this))
    this.app.use(this.logErrors.bind(this))

    const apiServiceClasses = container.resolve('ApiServerServices') as any[]
    this.apiServices = apiServiceClasses.map(cls => new cls(this.container))
    this.setupRoutes()
  }

  public async start() {
    return new Promise(resolve =>
      this.app.listen(this.config.port, () => {
        LOG.info('Listening on port {port}.', {
          port: this.config.port,
        })
        resolve()
      }),
    )
  }

  private setupRoutes() {
    this.apiServices.forEach(s => {
      LOG.debug(`Setting up API service at /{namespace}.`, {
        namespace: s.namespace,
      })
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
    const allowed = true // await this.authHandler.isAuthorized(req)

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

