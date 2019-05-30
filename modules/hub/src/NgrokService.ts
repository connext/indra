import { default as fetch } from 'node-fetch'

import { default as Config } from './Config'
import { maybe } from './util'

/**
 * ngrok is a service for exposing a local port to the internet on a public
 * URL (ex, 'https://abc123.ngrok.io' is forwarded to 'localhost:8080').
 *
 * This service contacts the locally running ngrok client to get the public
 * URL of the hub.
 *
 * Run ngrok with:
 *
 *   hub/development/ngrok-run
 *
 */
export class NgrokService {
  public constructor(
    private config: Config,
  ) {}

  public async getDevPublicUrl(): Promise<any> {
    if (!this.config.isDev) {
      throw new Error('Cannot call getDevPublicUrl() except from dev!')
    }

    /*
    "tunnels": [
      {
        "config": {
          "addr": "localhost:8080",
          "inspect": true
        },
        ...
        "name": "hub",
        "proto": "https",
        "public_url": "https://b6701fe4.ngrok.io",
        "uri": "/api/tunnels/hub"
      },
      ...
    ],
    ...
    */
    const [res, err] = await maybe(fetch('http://localhost:6940/api/tunnels'))
    if (err) {
      throw new Error(
        'Error connecting to ngrok to fetch public URL ' +
        '(hint: did you run "hub/development/ngrok-run"?)')
    }

    const obj = await res.json()
    for (const tun of obj.tunnels) {
      if (tun.name === 'hub') {
        return tun.public_url
      }
    }

    throw new Error(`Unexpected response from ngrok (no "hub" tunnel found): ` +
      `${JSON.stringify(obj)}`)
  }

}
