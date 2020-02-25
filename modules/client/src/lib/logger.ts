import { ILogger } from "@connext/types";

export class Logger implements ILogger {
  private levels: { [key: string]: number } = { debug: 4, error: 1, info: 3, warn: 2 };
  private defaultLevel = "info";
  private context = "Logger";
  public logLevel = 3;

  public constructor(context?: string, logLevel?: number) {
    this.context = typeof context !== "undefined" ? context : this.context;
    this.logLevel =
      typeof logLevel !== "undefined" ? parseInt(logLevel.toString(), 10) : this.logLevel;
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public newContext(context: string): Logger {
    return new Logger(context, this.logLevel);
  }

  public error(msg: string): void {
    this.print("error", msg);
  }

  public warn(msg: string): void {
    this.print("warn", msg);
  }

  public info(msg: string): void {
    this.print("info", msg);
  }

  public debug(msg: string): void {
    this.print("debug", msg);
  }

  private print(level: string, msg: any): void {
    if (this.levels[level] > this.logLevel) return;
    const now = new Date().toISOString();
    return (console as any)[level](`${now} [${this.context}] ${msg}`);
  }
}
