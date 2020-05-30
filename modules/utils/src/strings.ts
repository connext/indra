export const abbreviate = (str: string, prefixLen: number = 2, len: number = 4): string =>
  `${str.substring(0, prefixLen + len)}..${str.substring(str.length - len)}`;

export const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.substring(1);
