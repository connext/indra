import { getCreate2MultisigAddress } from "@connext/cf-core";
import { addressHistory } from "@connext/contracts";
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

// NOTE: edit these to scan for factory address on page load (output in console.log)
const expectedMultisig = "";
const ownerXpubs = [];

/* Example multisig we could scan for:
const expectedMultisig = "0x1508eCF431F5DeF63d708fa657a9c8dB5d153a78";
const ownerXpubs = [
  "xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m",
  "xpub6EMezVbdgTLk3tVi4sU6RGSXuUqnTkdi78DpHcoEUemuhHEypFkUMoRo4WCD37famujT1NYspsi7h7dzZpkyx9BkCizUCP5XfAKHjtiHCcR"
];
*/

const Admin = ({ messaging }) => {

  const chainId = "1";
  const scanForFactory = async (ownerXpubs, expectedMultisig) => {
    console.log(`Scanning for expected multisig: ${expectedMultisig}`);
    if (!ownerXpubs || !expectedMultisig) return;
    const provider = getDefaultProvider("homestead");
    for (const multisigMastercopy of addressHistory[chainId].MinimumViableMultisigAddresses) {
      for (const proxyFactory of addressHistory[chainId].ProxyFactoryAddresses) {
        for (const bytecode of [...addressHistory[chainId].toxicProxyBytecode, ""]) {
          for (const legacy of [true, false]) {
            const bc = bytecode.substring(0,8) || "0x000000";
            let calculated = await getCreate2MultisigAddress(
              ownerXpubs,
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
    (async () => console.log(await scanForFactory(ownerXpubs, expectedMultisig)))();
  });

  return (
    <RootGrid container spacing={3}>
      <GetIncorrectProxyFactoryAddress messaging={messaging} />
      <FixIncorrectProxyFactoryAddress messaging={messaging} />
    </RootGrid>
  );
};

export default Admin;
