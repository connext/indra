import { Wallet } from "ethers";
import { computeAddress, SigningKey } from "ethers/utils";
import { fromExtendedKey, fromMnemonic, HDNode } from "ethers/utils/hdnode";

/**
 * Helpful info:
 *
 * BIP-32 specified HD Wallets
 * BIP-39 specifies how to convert mnemonic to/from entropy and mnemonic to seed
 * BIP-43 specifies that the first field should be purpose (i.e. "m / purpose'")
 * BIP-44 specifies that if the purpose is 44, then the format is:
 *   "m / purpose' / cointype' / account' / change / index"
 */

export function computeRandomExtendedPrvKey(): string {
  return fromMnemonic(Wallet.createRandom().mnemonic).extendedKey;
}

export function sortAddresses(addrs: string[]): string[] {
  return addrs.sort((a: string, b: string): number => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));
}

function sortSigningkeys(addrs: SigningKey[]): SigningKey[] {
  return addrs.sort((a: SigningKey, b: SigningKey): number =>
    parseInt(a.address, 16) < parseInt(b.address, 16) ? -1 : 1,
  );
}

const xkeyKthAddressCache = {} as any;
export function xkeyKthAddress(xkey: string, k: number | string = "0"): string {
  const index = k.toString();
  if (!xkeyKthAddressCache[xkey]) {
    xkeyKthAddressCache[xkey] = {};
  }
  if (!xkeyKthAddressCache[xkey][index]) {
    xkeyKthAddressCache[xkey][index] = xkeyKthHDNode(xkey, index).address;
  }
  return xkeyKthAddressCache[xkey][k];
}

const xkeyKthNodeCache = {} as any;
export function xkeyKthHDNode(xkey: string, k: number | string = "0"): HDNode {
  const index = k.toString();
  if (!xkeyKthNodeCache[xkey]) {
    xkeyKthNodeCache[xkey] = {};
  }
  if (!xkeyKthNodeCache[xkey][index]) {
    xkeyKthNodeCache[xkey][index] = fromExtendedKey(xkey).derivePath(index);
  }
  return xkeyKthNodeCache[xkey][index];
}

export function xkeysToSortedKthAddresses(xkeys: string[], k: number): string[] {
  return sortAddresses(xkeys.map((xkey: string): string => xkeyKthAddress(xkey, k)));
}

export function xkeysToSortedKthSigningKeys(xkeys: string[], k: number): SigningKey[] {
  return sortSigningkeys(
    xkeys.map((xkey: string): SigningKey => new SigningKey(xkeyKthHDNode(xkey, k).privateKey)),
  );
}
