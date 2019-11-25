import { Logger } from "@nestjs/common";

export class CLogger extends Logger {
  public cxt: string;
  constructor(context: string) {
    super();
    this.cxt = context || "?";
  }
  log(message: string): void {
    super.log(message, this ? this.cxt : "?");
  }
  error(message: string, trace: string = "?"): void {
    super.error(message, trace, this ? this.cxt : "?");
  }
  warn(message: string): void {
    super.warn(message, this ? this.cxt : "?");
  }
  debug(message: string): void {
    super.debug(message, this ? this.cxt : "?");
  }
  verbose(message: string): void {
    super.verbose(message, this ? this.cxt : "?");
  }
}
