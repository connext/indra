import { Logger } from "@nestjs/common";

export class CLogger extends Logger {
  public cxt: string;
  constructor(context: string) {
    super();
    this.cxt = context || "";
  }
  log(message: string): void {
    super.log(message, this.cxt);
  }
  error(message: string, trace?: string): void {
    super.error(message, trace, this.cxt);
  }
  warn(message: string): void {
    super.warn(message, this.cxt);
  }
  debug(message: string): void {
    super.debug(message, this.cxt);
  }
  verbose(message: string): void {
    super.verbose(message, this.cxt);
  }
}
