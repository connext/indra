import { ILoggerService } from "@connext/types";

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

export class Logger implements ILoggerService {
  private color = true; // flag for turning color on/off
  private colors: { [key: string]: string } = {
    context: colors.FgCyan,
    debug: colors.FgMagenta,
    error: colors.FgRed,
    info: colors.FgGreen,
    warn: colors.FgYellow,
    reset: colors.Reset,
  };
  private context = "UnknownContext";
  private level = 3;
  private levels: { [key: string]: number } = { debug: 4, error: 1, info: 3, warn: 2 };
  private id = "?";

  public constructor(context?: string, level?: number, color?: boolean, id?: string) {
    this.context = typeof context !== "undefined" ? context : this.context;
    this.level = typeof level !== "undefined" ? parseInt(level.toString(), 10) : this.level;
    this.color = color || false;
    this.id = id || "?";
    if (!this.color) {
      this.colors = { context: "", debug: "", error: "", info: "", warn: "", reset: "" };
    }
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public newContext(context: string): Logger {
    return new Logger(context, this.level, this.color, this.id);
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

  private print(level: string, msg: string): void {
    if (this.levels[level] > this.level) return;
    const now = new Date().toISOString();
    console[level](
      `${now} ${this.colors[level]}${level.substring(0, 1).toUpperCase()} ` +
        `${this.colors.context}[${this.id}][${this.context}] ` +
        `${this.colors[level]}${msg}${this.colors.reset}`,
    );
  }
}
