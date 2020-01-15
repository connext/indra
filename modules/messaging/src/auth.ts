import * as natsutil from "ts-natsutil";
import { MessagingConfig } from ".";
import { Logger } from "./logger";

const defaultJWTAudience = "indra"; // FIXME: this is typically a url; it should be the hub's url

export class MessagingAuthService {
  private log: Logger;
  private auth: natsutil.AuthService;

  constructor(private readonly config: MessagingConfig) {
    if (!config.privateKey || !config.publicKey) {
      throw new Error("messaging auth service requires configured keypair");
    }

    this.log = new Logger(`MessagingAuthService`, config.logLevel);
    this.log.debug(`Created messaging auth service with config: ${JSON.stringify(config, null, 2)}`);

    this.auth = new natsutil.AuthService(defaultJWTAudience, config.privateKey, config.publicKey);
  }

  vend(subject: string, ttl: number, permissions: any): Promise<string> {
    return this.auth.vendBearerJWT(subject, ttl, permissions);
  }

  verify(bearerToken: string): boolean {
    return this.auth.verifyBearerJWT(bearerToken);
  }
}

// getNonce
// - node 'vends' jwt, returns it authed user...
// bearer of the jwt connects to NATS (this jwt contains signed permissions)
