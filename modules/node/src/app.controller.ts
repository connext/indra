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
  getHelloMessage(data: any): string {
    logger.log(`Got Hello message, data: ${JSON.stringify(data)}`);
    return this.appService.getHello();
  }
}
