import { Logger } from "@nestjs/common";

export class CLogger extends Logger {
  public cxt: string;
  constructor(context: string) {
    super();
    this.cxt = context || "UNKNOWN CONTEXT";
  }
  log(message: string): void {
    super.log(message, this.cxt);
  }
  error(message: string, trace: string = "No stack trace"): void {
    try {
      super.error(message, trace);
    } catch (e) {
      console.error(message);
      console.error(`WARNING Nest logger failed: ${e.message}`);
    }
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
