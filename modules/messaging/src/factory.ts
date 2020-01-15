import { MessagingService } from "./service";
import { IMessagingService, MessagingConfig } from "./types";

// FIXME: this is deprecated...
export class MessagingServiceFactory {

  constructor(private config: MessagingConfig, private bearerToken?: string) {}

  connect(): void {
    throw Error("Connect service using MessagingService.connect()");
  }

  createService(messagingServiceKey: string): IMessagingService {
    return new MessagingService(this.config, messagingServiceKey, this.bearerToken);
  }
}
