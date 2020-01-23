import { scanForCriticalAddresses } from "@connext/cf-core";
import { getDefaultProvider } from "ethers";
import React, { useState } from "react";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

const emptyResult = {
  legacyKeygen: "", proxyFactory: "", multisigMastercopy: "", toxicBytecode: "",
};

export const ScanCriticalAddresses = ({ messaging }) => {
  const [targetAddress, setTargetAddress] = useState("0x1508eCF431F5DeF63d708fa657a9c8dB5d153a78");
  const [ownerXpub1, setOwnerXpub1] = useState("xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m");
  const [ownerXpub2, setOwnerXpub2] = useState("xpub6EMezVbdgTLk3tVi4sU6RGSXuUqnTkdi78DpHcoEUemuhHEypFkUMoRo4WCD37famujT1NYspsi7h7dzZpkyx9BkCizUCP5XfAKHjtiHCcR");
  const [result, setResult] = useState(emptyResult);
  const [disabled, setDisabled] = useState(false);

  const scan = async () => {
    if (!targetAddress || !ownerXpub1 || !ownerXpub2) { return; }
    setDisabled(true);
    setResult(emptyResult);
    console.log(`Searching for historical addresses needed to deploy ${targetAddress}`);
    console.log(`scanForCriticalAddresses is a ${typeof scanForCriticalAddresses}`);
    const res = await scanForCriticalAddresses(
      [ownerXpub1, ownerXpub2 ],
      targetAddress,
      getDefaultProvider("homestead"),
    );
    if (res) {
      console.log("MATCH DETECTED");
      console.log(`legacyKeygen:  ${res.legacyKeygen}`);
      console.log(`mastercopy:    ${res.multisigMastercopy}`);
      console.log(`factory:       ${res.proxyFactory}`);
      console.log(`toxicBytecode: ${res.toxicBytecode}`);
    } else {
      console.log("No match detected :(");
    }
    setResult(res);
    setDisabled(false);
  };

  return (
    <Grid item xs={12} style={{textAlign: "center"}}>
      <TextField id="target-multisig-address" type="text" value={targetAddress} onChange={e => setTargetAddress(e.target.value)} variant={"outlined"} label={"Target Multisig Address"} margin={"normal"}/>
      <br/>
      <TextField id="owner-1-xpub" type="text" value={ownerXpub1} onChange={e => setOwnerXpub1(e.target.value)} variant={"outlined"} label={"Owner #1 xpub"} margin={"normal"}/>
      <br/>
      <TextField id="owner-2-xpub" type="text" value={ownerXpub2} onChange={e => setOwnerXpub2(e.target.value)} variant={"outlined"} label={"Owner #2 xpub"} margin={"normal"}/>
      <br/> <br/>
      <Button
        color="primary"
        variant="contained"
        onClick={scan}
        disabled={disabled}
      >
        Scan For Associated Critical Addresses
      </Button>
      <br/> <br/>
      <Typography align={"left"}>Legacy Keygen: {result.legacyKeygen.toString()}</Typography>
      <Typography align={"left"}>Proxy Factory: {result.proxyFactory}</Typography>
      <Typography align={"left"}>Multisig Mastercopy: {result.multisigMastercopy}</Typography>
      <Typography align={"left"}>Toxic Bytecode: {result.toxicBytecode}</Typography>
    </Grid>
  );
};
