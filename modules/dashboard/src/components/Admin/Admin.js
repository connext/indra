import React, { useEffect } from "react";
import Grid from '@material-ui/core/Grid';
import { styled } from '@material-ui/core/styles';
import { Contract, getDefaultProvider } from "ethers";
import { getAddress, Interface, keccak256, solidityKeccak256 } from "ethers/utils";
import { GetIncorrectProxyFactoryAddress, FixIncorrectProxyFactoryAddress } from "./IncorrectProxyFactory/IncorrectProxyFactoryAddressView";
import { fromExtendedKey } from "ethers/utils/hdnode";
import MinimumViableMultisig from "@connext/cf-funding-protocol-contracts/build/MinimumViableMultisig.json";
import ProxyFactory from "@connext/cf-funding-protocol-contracts/build/ProxyFactory.json";
import historicalData from "./historicalData";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

/*
 * Notes re ProxyBytecode
 * @counterfactual/cf-funding-protocol-contracts@0.0.8  apparently doesn't have any bytecode..?
 * @counterfactual/cf-funding-protocol-contracts@0.0.10 that stupid expected build folder appeared
 * @counterfactual/contracts@0.1.8 added an extra contracts folder of nesting & changed format..?
 * @counterfactual/contracts@0.1.9 removed nested contracts folder
 * order of bytecodes in historicalData: cf-funding 0.0.1 - 0.0.13, "", contracts 0.0.3 - 0.1.13
 */

// NOTE: edit these to scan for factory address on page load (output in console.log)
const expectedMultisig = "";
const owners = [];

const Admin = ({ messaging }) => {

  const legacyGetCreate2MultisigAddress = async (
    owners,
    proxyFactoryAddress,
    minimumViableMultisigAddress,
    ethProvider,
    isLegacy = false,
  ) => {
    const proxyFactory = new Contract(proxyFactoryAddress, ProxyFactory.abi, ethProvider);
    // Calculates xpub -> address without the last "/<index>" part of the path
    const xkeysToSortedKthAddresses = (xkeys) =>
      xkeys
        .map((xkey) =>
          isLegacy
            ? fromExtendedKey(xkey).address
            : fromExtendedKey(xkey).derivePath("0").address
        )
        .sort((a, b) => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));
    const ownerAddresses = xkeysToSortedKthAddresses(owners);
    // console.log(`Got ownerAddresses: ${JSON.stringify(ownerAddresses)}`);
    const proxyBytecode = await proxyFactory.functions.proxyCreationCode();
    return getAddress(
      solidityKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        [
          "0xff",
          proxyFactoryAddress,
          solidityKeccak256(
            ["bytes32", "uint256"],
            [
              keccak256(
                // see encoding notes
                new Interface(MinimumViableMultisig.abi).functions.setup.encode([
                  ownerAddresses,
                ]),
              ),
              0,
            ],
          ),
          solidityKeccak256(
            ["bytes", "uint256"],
            [`0x${proxyBytecode.replace("0x", "")}`, minimumViableMultisigAddress],
          ),
        ],
      ).slice(-40),
    );
  }

  const scanForFactory = async (owners, expectedMultisig) => {
    console.log(`Scanning for expected multisig: ${expectedMultisig}`);
    if (!owners || !expectedMultisig) return;
    const provider = getDefaultProvider("homestead");
    for (const multisig of historicalData.MinimumViableMultisigAddresses) {
      for (const factory of historicalData.ProxyFactoryAddresses) {
        let calculated = await legacyGetCreate2MultisigAddress(
          owners,
          factory,
          multisig,
          provider,
          true
        );
        console.log(`LEGACY  factory ${factory} + multisig ${multisig} => ${calculated}`);
        if (calculated === expectedMultisig) {
          return [true, multisig, factory];
        }
        calculated = await legacyGetCreate2MultisigAddress(
          owners,
          factory,
          multisig,
          provider,
          false
        );
        console.log(`CURRENT Factory ${factory} + multisig ${multisig} => ${calculated}`);
        if (calculated === expectedMultisig) {
          return [false, multisig, factory];
        }
      }
    }
    return "oh no none match :("
  }

  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => console.log(await scanForFactory(owners, expectedMultisig)))()
  });

  return (
    <RootGrid container spacing={3}>
      <GetIncorrectProxyFactoryAddress messaging={messaging} />
      <FixIncorrectProxyFactoryAddress messaging={messaging} />
    </RootGrid>
  );
};

export default Admin;
