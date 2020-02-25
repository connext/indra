export interface ILogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  setContext(context: string): void;
  newContext(context: string): ILogger;
}
