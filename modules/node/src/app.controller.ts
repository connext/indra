import { Controller, Get } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

import { AppService } from "./app.service";
import { CLogger } from "./util";

const logger = new CLogger("AppController");

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern("hello")
  getHelloNats(data: any): string {
    logger.log(`Got Hello NATS message, data: ${data}`);
    return this.appService.getHello();
  }
}
