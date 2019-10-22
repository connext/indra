import { NatsMessagingService } from "./nats";
import { IMessagingService, MessagingConfig } from "./types";
import { WsMessagingService } from "./ws";

export class MessagingServiceFactory {
  private serviceType: string;

  constructor(private config: MessagingConfig) {
    const { messagingUrl } = config as any;
    if (!messagingUrl) {
      throw new Error(`No messaging url provided. Config: ${JSON.stringify(config)}`);
    }
    if (typeof messagingUrl === "string") {
      this.serviceType = messagingUrl.startsWith("nats://") ? "nats" : "ws";
    } else if (messagingUrl[0] && messagingUrl[0].startsWith("nats://")) {
      this.serviceType = "nats";
    } else {
      throw new Error(`Invalid Messaging Url: ${JSON.stringify(messagingUrl)}`);
    }
  }

  connect(): void {
    throw Error("Connect service using NatsMessagingService.connect()");
  }

  createService(messagingServiceKey: string): IMessagingService {
    return this.serviceType === "ws"
      ? new WsMessagingService(this.config, messagingServiceKey)
      : new NatsMessagingService(this.config, messagingServiceKey);
  }
}
