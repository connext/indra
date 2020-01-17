export const delay = async (ms: number) =>
  new Promise((res: Function): number => setTimeout(res, ms));
