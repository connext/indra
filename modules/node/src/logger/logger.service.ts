import { ILogger } from "@connext/types";
import { Injectable, Scope, Logger as NestLogger } from "@nestjs/common";

// TODO: can we import & use ColorfulLogger from @connext/utils here?

const colors = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",
  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",
  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends NestLogger implements ILogger {
  private levels: { [key: string]: number } = {
    debug: 4,
    error: 1,
    info: 3,
    warn: 2,
  };
  private defaultLevel = "info";
  private color: { [key: string]: string } = {
    debug: colors.FgMagenta,
    error: colors.FgRed,
    info: colors.FgGreen,
    warn: colors.FgYellow,
  };

  public context: string;
  public logLevel: number = parseInt(process.env.INDRA_LOG_LEVEL, 10) || 3;

  public constructor(context?: string) {
    super();
    this.context = typeof context !== "undefined" ? context : "UnknownContext";
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public newContext(context: string): LoggerService {
    return new LoggerService(context);
  }

  public error(msg: string, stack?: string): void {
    this.print("error", msg);
    stack && this.print("error", stack);
  }

  public warn(msg: string): void {
    this.print("warn", msg);
  }

  // Nest internals expect a method called log
  public log(msg: string): void {
    this.print(this.defaultLevel, msg);
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
    return (console as any)[level](
      `${colors.Reset}${now} ${colors.FgCyan}[${this.context}]${colors.Reset} ${this.color[level]}${msg}${colors.Reset}`,
    );
  }
}
