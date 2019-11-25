import { Wallet } from "ethers";
import { computeAddress, SigningKey } from "ethers/utils";
import { fromExtendedKey, fromMnemonic, HDNode } from "ethers/utils/hdnode";
import memoize from "memoizee";

/**
 * BIP-32 specified HD Wallets
 * BIP-39 specifies how to convert mnemonic to/from entropy and mnemonic to seed
 * BIP-43 specifies that the first field should be purpose (i.e. "m / purpose'")
 * BIP-44 specifies format of: "m/purpose'/cointype'/account'/change/index" (iff purpose is 44)
 */

const xkeyKthHDNode = memoize(
  (xkey: string, k: string): HDNode => fromExtendedKey(xkey).derivePath(k),
  { max: 100, maxAge: 60 * 1000, primitive: true },
);

const sortSigningkeys = (addrs: SigningKey[]): SigningKey[] =>
  addrs.sort((a: SigningKey, b: SigningKey): number =>
    parseInt(a.address, 16) < parseInt(b.address, 16) ? -1 : 1,
  );

export const computeRandomExtendedPrvKey = (): string =>
  fromMnemonic(Wallet.createRandom().mnemonic).extendedKey;

export const sortAddresses = (addrs: string[]): string[] =>
  addrs.sort((a: string, b: string): number => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));

export const xkeyKthAddress = (xkey: string, k: number | string = "0"): string =>
  xkeyKthHDNode(xkey, k.toString()).address;

export const xkeysToSortedKthAddresses = (xkeys: string[], k: number | string = "0"): string[] =>
  sortAddresses(xkeys.map((xkey: string): string => xkeyKthAddress(xkey, k)));

export const xkeysToSortedKthSigningKeys = (
  xkeys: string[],
  k: number | string = "0",
): SigningKey[] =>
  sortSigningkeys(
    xkeys.map(
      (xkey: string): SigningKey => new SigningKey(xkeyKthHDNode(xkey, k.toString()).privateKey),
    ),
  );
