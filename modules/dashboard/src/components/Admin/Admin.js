import { scanForCriticalAddresses } from "@connext/cf-core";
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

/*
const expectedMultisig = "0x1508eCF431F5DeF63d708fa657a9c8dB5d153a78";
const ownerXpubs = [
  "xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m",
  "xpub6EMezVbdgTLk3tVi4sU6RGSXuUqnTkdi78DpHcoEUemuhHEypFkUMoRo4WCD37famujT1NYspsi7h7dzZpkyx9BkCizUCP5XfAKHjtiHCcR"
];
*/

const Admin = ({ messaging }) => {
  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => {
      if (!expectedMultisig || !ownerXpubs) { return; }
      console.log(`Searching for historical addresses needed to deploy ${expectedMultisig}`);
      const res = await scanForCriticalAddresses(
        ownerXpubs,
        expectedMultisig,
        addressHistory["1"],
        getDefaultProvider("homestead"),
      );
      if (res) {
        console.log("MATCH DETECTED");
        console.log(`calculated:    ${expectedMultisig}`);
        console.log(`legacyKeygen:  ${res.legacyKeygen}`);
        console.log(`mastercopy:    ${res.multisigMastercopy}`);
        console.log(`factory:       ${res.proxyFactory}`);
        console.log(`toxicBytecode: ${res.toxicBytecode}`);
      } else {
        console.log("No match detected :(");
      }
    })();
  });

  return (
    <RootGrid container spacing={3}>
      <GetIncorrectProxyFactoryAddress messaging={messaging} />
      <FixIncorrectProxyFactoryAddress messaging={messaging} />
    </RootGrid>
  );
};

export default Admin;
