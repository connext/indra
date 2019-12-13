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

const owners = [];
const expectedMultisig = "";

const MINIMUM_VIABLE_MULTISIG_ADDRESS = "0x12194a21bca6Ec9504a85ed0a27c736b27980fFf";
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
  ) => {
    const proxyFactory = new Contract(proxyFactoryAddress, ProxyFactory.abi, ethProvider);
    // Calculates xpub -> address without the last "/<index>" part of the path
    const xkeysToSortedKthAddresses = (xkeys) =>
      xkeys
        .map((xkey) => fromExtendedKey(xkey).address)
        .sort((a, b) => (parseInt(a, 16) < parseInt(b, 16) ? -1 : 1));
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
                  xkeysToSortedKthAddresses(owners),
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
    if (!owners || !expectedMultisig) return;
    const provider = getDefaultProvider("homestead");
    for (const factory of HISTORICAL_PROXY_FACTORY_ADDRESSES) {
      const multisig = await legacyGetCreate2MultisigAddress(
        owners,
        factory,
        MINIMUM_VIABLE_MULTISIG_ADDRESS,
        provider
      );
      console.log(`Comparing expected ${expectedMultisig} to calculated ${multisig}`);
      if (multisig === expectedMultisig) {
        return multisig;
      }
    }
    return "oh no none match:("
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
