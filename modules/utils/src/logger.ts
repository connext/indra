import { ILoggerService } from "@connext/types";

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
