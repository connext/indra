import { Logger } from "@nestjs/common";

export class CLogger extends Logger {
  public cxt: string;
  constructor(context: string) {
    super();
    this.cxt = context || "";
  }
  log(message: string) {
    super.log(message, this.cxt);
  }
  error(message: string, trace?: string) {
    super.error(message, trace, this.cxt);
  }
  warn(message: string) {
    super.warn(message, this.cxt);
  }
  debug(message: string) {
    super.debug(message, this.cxt);
  }
  verbose(message: string) {
    super.verbose(message, this.cxt);
  }
}
