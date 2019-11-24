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

// Primitive mode is faster but only works if params are strings or strings[]
// maxAge specifies how long the cache lives before being cleared
const memoizeOptions = { primitive: true, maxAge: 60 * 1000 };

const sortSigningkeys = memoize(
  (addrs: SigningKey[]): SigningKey[] =>
    addrs.sort((a: SigningKey, b: SigningKey): number =>
      parseInt(a.address, 16) < parseInt(b.address, 16) ? -1 : 1,
    ),
  memoizeOptions,
);

const xkeyKthHDNode = memoize(
  (xkey: string, k: number | string = "0"): HDNode =>
    fromExtendedKey(xkey).derivePath(k.toString()),
  memoizeOptions,
);

// Not deterministic: don't memoize
export const computeRandomExtendedPrvKey = (): string =>
  fromMnemonic(Wallet.createRandom().mnemonic).extendedKey;

export const sortAddresses = memoize(
  (addrs: string[]): string[] =>
    addrs.sort((a: string, b: string): number => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1)),
  memoizeOptions,
);

export const xkeyKthAddress = (xkey: string, k: number | string = "0"): string =>
  memoize((xkey: string, k: string): string => xkeyKthHDNode(xkey, k).address, memoizeOptions)(
    xkey,
    k.toString(),
  );

export const xkeysToSortedKthAddresses = memoize(
  (xkeys: string[], k: number): string[] =>
    sortAddresses(xkeys.map((xkey: string): string => xkeyKthAddress(xkey, k))),
  memoizeOptions,
);

export const xkeysToSortedKthSigningKeys = memoize(
  (xkeys: string[], k: number): SigningKey[] =>
    sortSigningkeys(
      xkeys.map((xkey: string): SigningKey => new SigningKey(xkeyKthHDNode(xkey, k).privateKey)),
    ),
  memoizeOptions,
);
