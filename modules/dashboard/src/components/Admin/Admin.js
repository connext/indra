import React, { useEffect } from "react";
import Grid from '@material-ui/core/Grid';
import { styled } from '@material-ui/core/styles';
import { Contract, getDefaultProvider } from "ethers";
import { getAddress, Interface, keccak256, solidityKeccak256 } from "ethers/utils";
import { GetIncorrectProxyFactoryAddress, FixIncorrectProxyFactoryAddress } from "./IncorrectProxyFactory/IncorrectProxyFactoryAddressView";
import { fromExtendedKey } from "ethers/utils/hdnode";
import MinimumViableMultisig from "@connext/cf-funding-protocol-contracts/build/MinimumViableMultisig.json";
import ProxyFactory from "@connext/cf-funding-protocol-contracts/build/ProxyFactory.json";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

// NOTE: edit these to scan for factory address on page load (output in console.log)
const expectedMultisig = "";
const owners = [];

const HISTORICAL_MINIMUM_VIABLE_MULTISIG_ADDRESSES = [
  "0x1284958470279156ED4Bca6fA1c012f2208c5CeB",
  "0x35a3C667e2274448e52F02C60e45d4662B6BCbC1",
  "0x12194a21bca6Ec9504a85ed0a27c736b27980fFf",
];
const HISTORICAL_PROXY_FACTORY_ADDRESSES = [
  "0x90Bf287B6870A99E32130CED0Da8b02302a8a4dE",
  "0xA16d9511C743d6D6177A65892DC2Eafd417BfD7A",
  "0xc756Bf6A685573C6879D4363401940f02B4E27a1",
  "0x6CF0c4Ab3F1e66913c0983DC0bb1202d958ABb8f",
  "0x711C655e08aaA9081e0BDc431920507CCD96b7a0",
  "0xF9015aA98BeBaE3e43945c48dc3fB6c0a5281986",
];

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
    for (const multisig of HISTORICAL_MINIMUM_VIABLE_MULTISIG_ADDRESSES) {
      for (const factory of HISTORICAL_PROXY_FACTORY_ADDRESSES) {
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
