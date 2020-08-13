import { ColorfulLogger, logTime } from "@connext/utils";

import { env } from "./env";

export const getTestLoggers = (context: string, start = Date.now()) => {
  const log = new ColorfulLogger(context.replace(" ", ""), env.logLevel, true, "Test");
  return { log, timeElapsed: (msg: string, start: number): void => logTime(log, start, msg) };
};
