export const mkAddress = (prefix: string = "0xa"): string => {
  return prefix.padEnd(42, "0");
};
