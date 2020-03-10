import { Injectable } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";

@Injectable()
export class TransferService {
  constructor(private readonly log: LoggerService) {
    this.log.setContext("TransferService");
  }
}
