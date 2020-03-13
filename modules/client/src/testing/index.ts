export const mkAddress = (prefix: string = "0x"): string => prefix.padEnd(42, "0");
export const mkHash = (prefix: string = "0x"): string => prefix.padEnd(66, "0");
