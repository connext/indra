import { scanForCriticalAddresses } from "@connext/cf-core";
import { getDefaultProvider } from "ethers";
import React, { useState } from "react";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

const emptyResult = {
  legacyKeygen: "",
  proxyFactory: "",
  minimumViableMultisig: "",
  toxicBytecode: "",
};

export const ScanCriticalAddresses = ({ messaging }) => {
  const [targetAddress, setTargetAddress] = useState("0x1508eCF431F5DeF63d708fa657a9c8dB5d153a78");
  const [ownerAddress1, setOwnerAddress1] = useState(
    "address6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m",
  );
  const [ownerAddress2, setOwnerAddress2] = useState(
    "address6EMezVbdgTLk3tVi4sU6RGSXuUqnTkdi78DpHcoEUemuhHEypFkUMoRo4WCD37famujT1NYspsi7h7dzZpkyx9BkCizUCP5XfAKHjtiHCcR",
  );
  const [result, setResult] = useState(emptyResult);
  const [disabled, setDisabled] = useState(false);

  const scan = async () => {
    if (!targetAddress || !ownerAddress1 || !ownerAddress2) {
      return;
    }
    setDisabled(true);
    setResult(emptyResult);
    console.log(`Searching for historical addresses needed to deploy ${targetAddress}`);
    console.log(`scanForCriticalAddresses is a ${typeof scanForCriticalAddresses}`);
    const res = await scanForCriticalAddresses(
      [ownerAddress1, ownerAddress2],
      targetAddress,
      getDefaultProvider("homestead"),
    );
    if (res) {
      console.log("MATCH DETECTED");
      console.log(`legacyKeygen:  ${res.legacyKeygen}`);
      console.log(`mastercopy:    ${res.minimumViableMultisig}`);
      console.log(`factory:       ${res.proxyFactory}`);
      console.log(`toxicBytecode: ${res.toxicBytecode}`);
    } else {
      console.log("No match detected :(");
    }
    setResult(res);
    setDisabled(false);
  };

  return (
    <Grid item xs={12} style={{ textAlign: "center" }}>
      <TextField
        id="target-multisig-address"
        type="text"
        value={targetAddress}
        onChange={e => setTargetAddress(e.target.value)}
        variant={"outlined"}
        label={"Target Multisig Address"}
        margin={"normal"}
      />
      <br />
      <TextField
        id="owner-1-address"
        type="text"
        value={ownerAddress1}
        onChange={e => setOwnerAddress1(e.target.value)}
        variant={"outlined"}
        label={"Owner #1 address"}
        margin={"normal"}
      />
      <br />
      <TextField
        id="owner-2-address"
        type="text"
        value={ownerAddress2}
        onChange={e => setOwnerAddress2(e.target.value)}
        variant={"outlined"}
        label={"Owner #2 address"}
        margin={"normal"}
      />
      <br /> <br />
      <Button color="primary" variant="contained" onClick={scan} disabled={disabled}>
        Scan For Associated Critical Addresses
      </Button>
      <br /> <br />
      <Typography align={"left"}>Legacy Keygen: {result.legacyKeygen.toString()}</Typography>
      <Typography align={"left"}>Proxy Factory: {result.proxyFactory}</Typography>
      <Typography align={"left"}>Multisig Mastercopy: {result.minimumViableMultisig}</Typography>
      <Typography align={"left"}>Toxic Bytecode: {result.toxicBytecode}</Typography>
    </Grid>
  );
};
