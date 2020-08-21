import { Injectable, Scope, Logger as NestLogger } from "@nestjs/common";
import { PinoLogger } from "@connext/utils";

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends NestLogger {
  private internal: PinoLogger;
  public logLevel: number = parseInt(process.env.INDRA_LOG_LEVEL || "3", 10);

  public constructor(context?: string) {
    super();
    this.internal = new PinoLogger(context, this.logLevel);
  }

  public setContext(context: string): void {
    this.internal.setContext(context);
  }

  public newContext(context: string): LoggerService {
    return new LoggerService(context);
  }

  public error(details: object, message: string): void {
    this.internal.error(message, details);
  }

  public warn(details: object, message: string): void {
    this.internal.warn(message, details);
  }

  // Nest internals expect a method called log
  public log(details: object, message: string): void {
    this.internal.info(message, details);
  }

  public info(details: object, message: string): void {
    this.internal.info(message, details);
  }

  public debug(details: object, message: string): void {
    this.internal.debug(message, details);
  }
}
