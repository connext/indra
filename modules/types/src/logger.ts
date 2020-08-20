// Designed to be as simple as possible so client users can easily inject their own
export interface ILogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// Designed to give devs power over log format & context switching
export interface ILoggerService extends ILogger {
  setContext(context: string): void;
  newContext(context: string): ILoggerService;
}

export const LogLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
  silent: 6,
} as const;
export type LogLevel = keyof typeof LogLevels;
