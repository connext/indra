import { ILogger } from "./types";

export const nullLogger: ILogger = {
  debug: (msg: string): any => {},
  info: (msg: string): any => {},
  warn: (msg: string): any => {},
  error: (msg: string): any => {},
  setContext: (context: string): any => {},
  newContext: (context: string): any => {},
};
