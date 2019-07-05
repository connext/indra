import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { NatsClientProviderId } from "./constants";

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@Inject(NatsClientProviderId) private readonly natsClient: ClientProxy) {}
  getHello(): string {
    return "Hello World!";
  }

  onModuleInit(): void {
    this.natsClient.connect();
  }
}
