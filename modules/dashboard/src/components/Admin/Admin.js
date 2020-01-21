import { getCreate2MultisigAddress } from "@connext/cf-core";
import historicalData from "@connext/contracts/address-history.json";
import Grid from "@material-ui/core/Grid";
import { styled } from "@material-ui/core/styles";
import { getDefaultProvider } from "ethers";
import React, { useEffect } from "react";

import {
  GetIncorrectProxyFactoryAddress, FixIncorrectProxyFactoryAddress,
} from "./IncorrectProxyFactory/IncorrectProxyFactoryAddressView";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

/*
 * Notes re ProxyBytecode in historicalData
 * the first bytecode is ""
 * this is important bc this signals that we should use the one from the factory
 */

// NOTE: edit these to scan for factory address on page load (output in console.log)
const expectedMultisig = "";
const owners = [];

const Admin = ({ messaging }) => {

  const scanForFactory = async (owners, expectedMultisig) => {
    console.log(`Scanning for expected multisig: ${expectedMultisig}`);
    if (!owners || !expectedMultisig) return;
    const provider = getDefaultProvider("homestead");
    for (const multisigMastercopy of historicalData.MinimumViableMultisigAddresses) {
      for (const proxyFactory of historicalData.ProxyFactoryAddresses) {
        for (const bytecode of historicalData.proxyBytecode) {
          for (const legacy of [true, false]) {
            const bc = bytecode.substring(0,8) || "0x000000";
            let calculated = await getCreate2MultisigAddress(
              owners,
              { proxyFactory, multisigMastercopy },
              provider,
              legacy,
              bytecode
            );
            console.log(
              `factory ${proxyFactory} + multisig ${multisigMastercopy} + bytecode ` +
              `${bc}... + legacy ${legacy} => ${calculated}`,
            );
            if (calculated === expectedMultisig) {
              console.log("MATCH DETECTED");
              console.log(`calculated: ${calculated}`);
              console.log(`isLegacy:   ${legacy}`);
              console.log(`mastercopy: ${multisigMastercopy}`);
              console.log(`factory:    ${proxyFactory}`);
              console.log(`bytecode:   ${bytecode}`);
              return [legacy, multisigMastercopy, proxyFactory, bytecode];
            }
          }
        }
      }
    }
    return "oh no none match :(";
  };

  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => console.log(await scanForFactory(owners, expectedMultisig)))();
  });

  return (
    <RootGrid container spacing={3}>
      <GetIncorrectProxyFactoryAddress messaging={messaging} />
      <FixIncorrectProxyFactoryAddress messaging={messaging} />
    </RootGrid>
  );
};

Admin.propTypes = { messaging: "any" };

export default Admin;
