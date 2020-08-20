import { ColorfulLogger, logTime } from "@connext/utils";

import { env } from "./env";

export const getTestLoggers = (context: string) => {
  const log = new ColorfulLogger(context.replace(" ", ""), env.logLevel, true, "Test");
  return { log, timeElapsed: (msg: string, start: number): void => logTime(log, start, msg) };
};

export const combineObjects = (overrides: any, defaults: any): any => {
  if (!overrides && defaults) {
    return { ...defaults };
  }
  const ret = { ...defaults };
  Object.entries(defaults).forEach(([key, value]) => {
    // if there is non override, return without updating defaults
    if (!overrides[key]) {
      // no comparable value, return
      return;
    }

    if (overrides[key] && typeof overrides[key] === "object") {
      ret[key] = { ...(value as any), ...overrides[key] };
      return;
    }

    if (overrides[key] && typeof overrides[key] !== "object") {
      ret[key] = overrides[key];
    }

    // otherwise leave as default
    return;
  });
  return ret;
};
