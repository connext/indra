import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { MessagingClientProviderId } from "./constants";

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy) {}
  getHello(): string {
    return "Hello World!";
  }

  onModuleInit(): void {
    this.messagingClient.connect();
  }
}
