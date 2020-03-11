import { CriticalStateChannelAddresses, ILoggerService } from "@connext/types";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { Provider } from "ethers/providers";
import {
  BigNumber,
  bigNumberify,
  getAddress,
  Interface,
  joinSignature,
  keccak256,
  recoverAddress,
  Signature,
  solidityKeccak256,
} from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { JSON_STRINGIFY_SPACE } from "./constants";
import { addressBook, addressHistory, MinimumViableMultisig, ProxyFactory } from "./contracts";
import { StateChannel } from "./models";
import { xkeyKthAddress } from "./machine";
import { INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET } from "./methods";

export const logTime = (log: ILoggerService, start: number, msg: string) => {
  const diff = Date.now() - start;
  const message = `${msg} in ${diff} ms`;
  if (diff < 10) {
    log.debug(message);
  } else if (diff < 100) {
    log.info(message);
  } else if (diff < 1000) {
    log.warn(message);
  } else {
    log.error(message);
  }
};

export function getFirstElementInListNotEqualTo(test: string, list: string[]) {
  return list.filter(x => x !== test)[0];
}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export const bigNumberifyJson = (json: object) =>
  JSON.parse(JSON.stringify(json), (key, val) => (val && val["_hex"] ? bigNumberify(val) : val));

export const deBigNumberifyJson = (json: object) =>
  JSON.parse(JSON.stringify(json), (key, val) =>
    val && BigNumber.isBigNumber(val) ? val.toHexString() : val,
  );
/**
 * Converts an array of signatures into a single string
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytes(...signatures: Signature[]): string {
  return signatures
    .map(joinSignature)
    .map(s => s.substr(2))
    .reduce((acc, v) => acc + v, "0x");
}

/**
 * Sorts signatures in ascending order of signer address
 *
 * @param signatures An array of etherium signatures
 */
export function sortSignaturesBySignerAddress(
  digest: string,
  signatures: Signature[],
): Signature[] {
  const ret = signatures.slice();
  ret.sort((sigA, sigB) => {
    const addrA = recoverAddress(digest, signaturesToBytes(sigA));
    const addrB = recoverAddress(digest, signaturesToBytes(sigB));
    return new BigNumber(addrA).lt(addrB) ? -1 : 1;
  });
  return ret;
}

/**
 * Sorts signatures in ascending order of signer address
 * and converts them into bytes
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytesSortedBySignerAddress(
  digest: string,
  ...signatures: Signature[]
): string {
  return signaturesToBytes(...sortSignaturesBySignerAddress(digest, signatures));
}

export function prettyPrintObject(object: any) {
  return JSON.stringify(object, null, JSON_STRINGIFY_SPACE);
}

export async function sleep(timeInMilliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, timeInMilliseconds));
}

/**
 * Computes the address of a counterfactual MinimumViableMultisig contract
 * as it would be if deployed via the `createProxyWithNonce` method on a
 * ProxyFactory contract with the bytecode of a Proxy contract pointing to
 * a `masterCopy` of a MinimumViableMultisig contract.
 *
 * See https://solidity.readthedocs.io/en/v0.5.11/assembly.html?highlight=create2
 * for information on how CREAT2 addresses are calculated.
 *
 * @export
 * @param {string[]} owners - the addresses of the owners of the multisig
 * @param {string} proxyFactoryAddress - address of ProxyFactory library
 * @param {string} multisigMastercopyAddress - address of masterCopy of multisig
 * @param {string} provider - to fetch proxyBytecode from the proxyFactoryAddress
 *
 * @returns {string} the address of the multisig
 *
 * NOTE: if the encoding of the multisig owners is changed YOU WILL break all
 * existing channels
 */
// TODO: memoize?
export const getCreate2MultisigAddress = async (
  owners: string[],
  addresses: CriticalStateChannelAddresses,
  ethProvider: Provider,
  legacyKeygen?: boolean,
  toxicBytecode?: string,
): Promise<string> => {
  const proxyFactory = new Contract(addresses.proxyFactory, ProxyFactory.abi, ethProvider);

  const xkeysToSortedKthAddresses = xkeys =>
    xkeys
      .map(xkey =>
        legacyKeygen === true
          ? fromExtendedKey(xkey).address
          : fromExtendedKey(xkey).derivePath("0").address,
      )
      .sort((a, b) => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));

  const proxyBytecode = toxicBytecode || (await proxyFactory.functions.proxyCreationCode());

  return getAddress(
    solidityKeccak256(
      ["bytes1", "address", "uint256", "bytes32"],
      [
        "0xff",
        addresses.proxyFactory,
        solidityKeccak256(
          ["bytes32", "uint256"],
          [
            keccak256(
              // see encoding notes
              new Interface(MinimumViableMultisig.abi).functions.setup.encode([
                xkeysToSortedKthAddresses(owners),
              ]),
            ),
            0,
          ],
        ),
        solidityKeccak256(
          ["bytes", "uint256"],
          [`0x${proxyBytecode.replace(/^0x/, "")}`, addresses.multisigMastercopy],
        ),
      ],
    ).slice(-40),
  );
};

export const scanForCriticalAddresses = async (
  ownerXpubs: string[],
  expectedMultisig: string,
  ethProvider: Provider,
  moreAddressHistory?: {
    ProxyFactory: string[];
    MinimumViableMultisig: string[];
    ToxicBytecode: string[];
  },
): Promise<void | { [key: string]: string | boolean }> => {
  const chainId = (await ethProvider.getNetwork()).chainId;
  // First, consolidate all sources of addresses to scan

  // Falsy toxic bytecode (ie "") causes getCreate2MultisigAddress to fetch non-toxic value
  let toxicBytecodes: string[] = [""];
  if (addressHistory[chainId] && addressHistory[chainId].ToxicBytecode) {
    toxicBytecodes = toxicBytecodes.concat(addressHistory[chainId].ToxicBytecode);
  }
  if (moreAddressHistory && moreAddressHistory.ToxicBytecode) {
    toxicBytecodes = toxicBytecodes.concat(moreAddressHistory.ToxicBytecode);
  }
  toxicBytecodes = [...new Set(toxicBytecodes)]; // de-dup

  let mastercopies: string[] = [];
  if (addressHistory[chainId] && addressHistory[chainId].MinimumViableMultisig) {
    mastercopies = mastercopies.concat(addressHistory[chainId].MinimumViableMultisig);
  }
  if (addressBook[chainId] && addressBook[chainId].MinimumViableMultisig) {
    mastercopies.push(addressBook[chainId].MinimumViableMultisig.address);
  }
  if (moreAddressHistory && moreAddressHistory.MinimumViableMultisig) {
    mastercopies = mastercopies.concat(moreAddressHistory.MinimumViableMultisig);
  }
  mastercopies = [...new Set(mastercopies)]; // de-dup

  let proxyFactories: string[] = [];
  if (addressHistory[chainId] && addressHistory[chainId].ProxyFactory) {
    proxyFactories = proxyFactories.concat(addressHistory[chainId].ProxyFactory);
  }
  if (addressBook[chainId] && addressBook[chainId].ProxyFactory) {
    mastercopies.push(addressBook[chainId].ProxyFactory.address);
  }
  if (moreAddressHistory && moreAddressHistory.ProxyFactory) {
    proxyFactories = proxyFactories.concat(moreAddressHistory.ProxyFactory);
  }
  proxyFactories = [...new Set(proxyFactories)]; // de-dup

  // Second, scan these addresses looking for ones that match the given multisg
  for (const legacyKeygen of [false, true]) {
    for (const toxicBytecode of toxicBytecodes) {
      for (const multisigMastercopy of mastercopies) {
        for (const proxyFactory of proxyFactories) {
          let calculated = await getCreate2MultisigAddress(
            ownerXpubs,
            { proxyFactory, multisigMastercopy },
            ethProvider,
            legacyKeygen,
            toxicBytecode,
          );
          if (calculated === expectedMultisig) {
            return {
              legacyKeygen,
              multisigMastercopy,
              proxyFactory,
              toxicBytecode,
            };
          }
        }
      }
    }
  }
  return;
};

// NOTE: will not fail if there is no free balance class. there is
// no free balance in the case of a channel between virtual
// participants
export function assertSufficientFundsWithinFreeBalance(
  channel: StateChannel,
  publicIdentifier: string,
  tokenAddress: string,
  depositAmount: BigNumber,
): void {
  if (!channel.hasFreeBalance) return;

  const freeBalanceForToken =
    channel.getFreeBalanceClass().getBalance(tokenAddress, xkeyKthAddress(publicIdentifier, 0)) ||
    Zero;

  if (freeBalanceForToken.lt(depositAmount)) {
    throw Error(
      INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET(
        publicIdentifier,
        channel.multisigAddress,
        tokenAddress,
        freeBalanceForToken,
        depositAmount,
      ),
    );
  }
}
