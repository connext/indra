export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export const delayAndThrow = (ms: number, msg: string = ""): Promise<void> =>
  new Promise((res: any, rej: any): any => setTimeout((): void => rej(new Error(msg)), ms));
