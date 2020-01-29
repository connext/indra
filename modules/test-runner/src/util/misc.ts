import { expect } from ".";

export const delay = async (ms: number) =>
  new Promise((res: Function): number => setTimeout(res, ms));

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

export const fastForwardDuringCall = async (
  ms: number,
  cb: () => Promise<any> /* function to call*/,
  clock: any /* sinon fake timer */,
  failsWith?: string /* failure message */,
  delays: number[] = [3000] /* delay before clock is fast forwarded */,
): Promise<any> => {
  if (!clock) {
    throw new Error(`clock must be set before calling fast forward`);
  }

  // advance clock after the callback has been called,
  // so the timers can all be set properly
  delays.forEach((delay, index) => {
    const offset = index * ms;
    // make sure that the setTimeout is in the next iteration
    // of the clock tick
    setTimeout(() => {
      clock.tick(ms);
    }, delay + offset);
  });

  if (failsWith) {
    await expect(cb()).to.be.rejectedWith(failsWith);
    return;
  }

  return await cb();
};
