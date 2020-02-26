// Designed to be as simple as possible so client users can easily inject their own
export interface ILog {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// Designed to give Indra devs flexibility in managing logger context tags
// These methods are internal, our users shouldn't know/care about them.
export interface ILogger extends ILog {
  setContext(context: string): void;
  newContext(context: string): ILogger;
}

export const nullLogger: ILogger = {
  debug: (msg: string): void => {},
  info: (msg: string): void => {},
  warn: (msg: string): void => {},
  error: (msg: string): void => {},
  setContext: (context: string): void => {},
  newContext: function(context: string): ILogger {
    return this;
  },
};
