import * as natsutil from "ts-natsutil";
import { MessagingConfig, nullLogger, ILoggerService } from "@connext/types";

export class MessagingAuthService {
  private log: ILoggerService;
  private auth: natsutil.AuthService;
  private defaultJWTAudience: string;

  constructor(private readonly config: MessagingConfig) {
    if (!this.config.privateKey || !this.config.publicKey) {
      throw new Error("messaging auth service requires configured keypair");
    }

    this.log = this.config.logger || nullLogger;
    this.log.debug(
      `Created messaging auth service with config: ${JSON.stringify(config, null, 2)}`,
    );

    this.defaultJWTAudience = this.config.messagingUrl as string;
    this.auth = new natsutil.AuthService(
      this.defaultJWTAudience,
      this.config.privateKey,
      this.config.publicKey,
    );
  }

  vend(subject: string, ttl: number, permissions: any): Promise<string> {
    return this.auth.vendBearerJWT(subject, ttl, permissions);
  }

  verify(bearerToken: string): boolean {
    return this.auth.verifyBearerJWT(bearerToken);
  }
}
