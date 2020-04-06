import { CriticalStateChannelAddresses, ILoggerService, sortByAddress } from "@connext/types";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import {
  BigNumber,
  defaultAbiCoder,
  getAddress,
  Interface,
  keccak256,
  solidityKeccak256,
} from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET } from "./errors";
import { addressBook, addressHistory, MinimumViableMultisig, ProxyFactory } from "./contracts";
import { StateChannel } from "./models";
import { xkeyKthAddress } from "./xkeys";
import { AppIdentity } from "./types";
import memoize from "memoizee";

export const logTime = (log: ILoggerService, start: number, msg: string) => {
  const diff = Date.now() - start;
  const message = `${msg} in ${diff} ms`;
  if (diff < 5) {
    log.debug(message);
  } else if (diff < 50) {
    log.info(message);
  } else if (diff < 250) {
    log.warn(message);
  } else {
    log.error(message);
  }
};

export function appIdentityToHash(appIdentity: AppIdentity): string {
  return keccak256(
    defaultAbiCoder.encode(
      ["uint256", "address[]"],
      [appIdentity.channelNonce, appIdentity.participants],
    ),
  );
}

export const APP_IDENTITY = `tuple(address[] participants,address appDefinition,uint256 defaultTimeout)`;

export function getFirstElementInListNotEqualTo(test: string, list: string[]) {
  return list.filter(x => x !== test)[0];
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
 * @param {string} addresses - critical addresses required to deploy multisig
 * @param {string} ethProvider - to fetch proxyBytecode from the proxyFactoryAddress
 * @param {string} legacyKeygen - Should we use CF_PATH or `${CF_PATH}/0` ?
 * @param {string} toxicBytecode - Use given bytecode if given instead of fetching from proxyFactory
 *
 * @returns {string} the address of the multisig
 *
 * NOTE: if the encoding of the multisig owners is changed YOU WILL break all
 * existing channels
 */
export const getCreate2MultisigAddress = async (
  owners: string[],
  addresses: CriticalStateChannelAddresses,
  ethProvider: JsonRpcProvider,
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
      .sort(sortByAddress);

  const proxyBytecode = toxicBytecode || (await proxyFactory.functions.proxyCreationCode());

  return memoizedGetAddress(
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

const memoizedGetAddress = memoize((params: string): string => getAddress(params), {
  max: 100,
  maxAge: 60 * 1000,
  primitive: true,
});

export const scanForCriticalAddresses = async (
  ownerXpubs: string[],
  expectedMultisig: string,
  ethProvider: JsonRpcProvider,
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

export function assertSufficientFundsWithinFreeBalance(
  channel: StateChannel,
  publicIdentifier: string,
  tokenAddress: string,
  depositAmount: BigNumber,
): void {
  const freeBalanceForToken =
    channel.getFreeBalanceClass().getBalance(tokenAddress, xkeyKthAddress(publicIdentifier, 0)) ||
    Zero;

  if (freeBalanceForToken.lt(depositAmount)) {
    throw new Error(
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
