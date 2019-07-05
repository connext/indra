export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}
