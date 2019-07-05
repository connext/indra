import { ethers as eth } from "ethers";

export function freeBalanceAddressFromXpub(xpub: string): string {
  return eth.utils.HDNode.fromExtendedKey(xpub).derivePath("0").address;
}
