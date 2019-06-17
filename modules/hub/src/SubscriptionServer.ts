import * as WebSocket from 'ws'

import Config from './Config'
import { Logger } from './util'

export class SubscriptionServer {
  private config: Config
  private log: Logger
  public server: WebSocket.Server

  public constructor(config: Config) {
    this.log = new Logger('SubscriptionServer', config.logLevel)

    if (!config.websocketPort) {
      this.log.info('No websocket port provided, not starting')
      return
    }

    this.server = new WebSocket.Server({ port: config.websocketPort })
    this.log.info(`Listening on port: ${config.websocketPort}`)

    this.server.on('connection', (ws: WebSocket, req: any): void => {
      const ip: string = req.connection.remoteAddress // TODO: check x-forwarded-for header
      this.log.info(`New WebSocket connection established with: ${ip}`)

      // The client shouldn't need to write to the subscription ws endpoint
      // But we'll log anything that's written just in case
      ws.on('message', (message: string): void => {
        if (message.length > 0) {
          this.log.info(`WebSocket received message: ${message}`)
        }
      })

      ws.on('close', (): void => {
        this.log.info(`WebSocket connection closed with: ${ip}`)
      })

      ws.on('error', (e: any): void => {
        this.log.info(`WebSocket error with ${ip}: ${e.message}`)
      })

    })
  }

  public broadcast(data: string): void {
    this.log.info(`Broadcasting: ${data}`)
    this.server.clients.forEach((client: WebSocket): void => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

}
