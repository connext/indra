import React, { useEffect } from "react";
import Grid from '@material-ui/core/Grid';
import { styled } from '@material-ui/core/styles';
import { Contract, getDefaultProvider } from "ethers";
import { getAddress, Interface, keccak256, solidityKeccak256 } from "ethers/utils";
import { GetIncorrectProxyFactoryAddress, FixIncorrectProxyFactoryAddress } from "./IncorrectProxyFactory/IncorrectProxyFactoryAddressView";
import { fromExtendedKey } from "ethers/utils/hdnode";
import MinimumViableMultisig from "@connext/contracts/build/MinimumViableMultisig.json";
import ProxyFactory from "@connext/contracts/build/ProxyFactory.json";
import historicalData from "./historicalData";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

/*
 * Notes re ProxyBytecode
 * the first bytecode is "", this is important bc this signals that we should use the one from the factory
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
    toxicBytecode,
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
    const proxyBytecode = toxicBytecode || await proxyFactory.functions.proxyCreationCode();
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
        for (const bytecode of historicalData.proxyBytecode) {
          for (const legacy of [true, false]) {
            const bc = bytecode.substring(0,8) || `0x000000`;
            let calculated = await legacyGetCreate2MultisigAddress(
              owners,
              factory,
              multisig,
              provider,
              legacy,
              bytecode
            );
            console.log(
              `factory ${factory} + multisig ${multisig} + bytecode ${bc}... + legacy ${legacy}` +
              ` => ${calculated}`,
            );
            if (calculated === expectedMultisig) {
              console.log(`MATCH DETECTED`);
              console.log(`calculated: ${calculated}`);
              console.log(`legacy:     ${legacy}`);
              console.log(`multisig:   ${multisig}`);
              console.log(`factory:    ${factory}`);
              console.log(`bytecode:   ${bytecode}`);
              return [legacy, multisig, factory, bytecode];
            }
          }
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
