import { CriticalStateChannelAddresses, PublicIdentifier } from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { BigNumber, Contract, providers, constants, utils } from "ethers";
import memoize from "memoizee";

import { INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET } from "./errors";
import { MinimumViableMultisig, ProxyFactory } from "./contracts";
import { StateChannel } from "./models";

const { Zero } = constants;
const { getAddress, Interface, keccak256, solidityKeccak256 } = utils;

export const assertSufficientFundsWithinFreeBalance = (
  channel: StateChannel,
  publicIdentifier: string,
  tokenAddress: string,
  depositAmount: BigNumber,
): void => {
  const freeBalanceForToken =
    channel
      .getFreeBalanceClass()
      .getBalance(tokenAddress, getSignerAddressFromPublicIdentifier(publicIdentifier)) || Zero;

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
};

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
 *
 * @returns {string} the address of the multisig
 *
 * NOTE: if the encoding of the multisig owners is changed YOU WILL break all
 * existing channels
 */
export const getCreate2MultisigAddress = async (
  initiatorIdentifier: PublicIdentifier,
  responderIdentifier: PublicIdentifier,
  addresses: CriticalStateChannelAddresses,
  ethProvider: providers.JsonRpcProvider,
): Promise<string> => {
  const proxyFactory = new Contract(addresses.ProxyFactory, ProxyFactory.abi, ethProvider);

  const proxyBytecode = await proxyFactory.proxyCreationCode();

  return memoizedGetAddress(
    solidityKeccak256(
      ["bytes1", "address", "uint256", "bytes32"],
      [
        "0xff",
        addresses.ProxyFactory,
        solidityKeccak256(
          ["bytes32", "uint256"],
          [
            keccak256(
              // see encoding notes
              new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
                [
                  getSignerAddressFromPublicIdentifier(initiatorIdentifier),
                  getSignerAddressFromPublicIdentifier(responderIdentifier),
                ],
              ]),
            ),
            // hash chainId + saltNonce to ensure multisig addresses are *always* unique
            solidityKeccak256(["uint256", "uint256"], [ethProvider.network.chainId, 0]),
          ],
        ),
        solidityKeccak256(
          ["bytes", "uint256"],
          [`0x${proxyBytecode.replace(/^0x/, "")}`, addresses.MinimumViableMultisig],
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
