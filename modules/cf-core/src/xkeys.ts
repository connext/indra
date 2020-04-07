import { Wallet } from "ethers";
import { fromExtendedKey, fromMnemonic, HDNode } from "ethers/utils/hdnode";
import memoize from "memoizee";

/**
 * BIP-32 specified HD Wallets
 * BIP-39 specifies how to convert mnemonic to/from entropy and mnemonic to seed
 * BIP-43 specifies that the first field should be purpose (i.e. "m / purpose'")
 * BIP-44 specifies format of: "m/purpose'/cointype'/account'/change/index" (iff purpose is 44)
 */

export const xkeyKthHDNode = memoize(
  (xkey: string, k: string): HDNode => fromExtendedKey(xkey).derivePath(k),
  {
    max: 100,
    maxAge: 60 * 1000,
    primitive: true,
  },
);

export const computeRandomExtendedPrvKey = (): string =>
  fromMnemonic(Wallet.createRandom().mnemonic).extendedKey;

export const xkeyKthAddress = (xkey: string, k: number | string = "0"): string =>
  xkeyKthHDNode(xkey, k.toString()).address;
