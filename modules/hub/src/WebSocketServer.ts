import * as WebSocket from 'ws'
import Config from './Config'

export class SubscriptionServer {
  public server: WebSocket.Server
  private sockets: WebSocket[]
  private config: Config

  public constructor(config: Config) {
    this.server = new WebSocket.Server({ port: config.port + 1 })

    this.server.on('connection', (ws: WebSocket): void => {
      //LOG.info(`New WS connection established`)

      ws.on('message', (message: any): void => {
        // The client shouldn't ever need to write to the subscription ws endpoint
        // But we'll log anything that's written just incase something weird happens
        //LOG.info(`WS received message: ${message}`)
      })

    })

  }

}
