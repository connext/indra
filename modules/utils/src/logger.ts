import { ILogger, ILoggerService } from "@connext/types";

export const logTime = (log: ILogger, start: number, msg: string) => {
  const diff = Date.now() - start;
  const message = `${msg} in ${diff} ms`;
  if (diff < 10) {
    log.info(message);
  } else if (diff < 250) {
    log.info(message);
  } else {
    log.info(message);
  }
};

// Example implementation that can be used as a silent default
export const nullLogger: ILoggerService = {
  debug: (msg: string): void => {},
  info: (msg: string): void => {},
  warn: (msg: string): void => {},
  error: (msg: string): void => {},
  setContext: (context: string): void => {},
  newContext: function(context: string): ILoggerService {
    return this;
  },
};

export class ConsoleLogger implements ILoggerService {
  private levels: { [key: string]: number } = { debug: 4, error: 1, info: 3, warn: 2 };
  private context = "UnknownContext";
  private log: ILogger = console;
  public level = 3;

  public constructor(context?: string, level?: number, log?: ILogger) {
    this.context = typeof context !== "undefined" ? context : this.context;
    this.level = typeof level !== "undefined" ? parseInt(level.toString(), 10) : this.level;
    this.log = typeof log !== "undefined" ? log : this.log;
  }

  public setContext(context: string): void {
    this.context = context;
  }

  public newContext(context: string): ConsoleLogger {
    return new ConsoleLogger(context, this.level);
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
    this.log[level](`${new Date().toISOString()} [${this.context}] ${msg}`);
  }
}

