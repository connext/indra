import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@material-ui/core";
import React, { useState } from "react";

import { useAddress, AddressInput } from "./input";

export const WithdrawSaiDialog = ({ channel, ethProvider, machine, state, saiBalance }) => {
  const [recipient, setRecipient] = useAddress(null, ethProvider);
  const [withdrawing, setWithdrawing] = useState(false);

  const withdrawSai = async () => {
    if (!recipient || !recipient.value || recipient.error) {
      return;
    }
    setWithdrawing(true);
    machine.send("READY");
    machine.send("START_WITHDRAW");
    const result = await channel.withdraw({
      amount: saiBalance.toString(),
      assetId: channel.config.contractAddresses.SAIToken,
      recipient: recipient.value,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    console.log(`Withdrawing ${saiBalance.format()} SAI to: ${recipient.value}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  return (
    <Dialog
      open={state.matches("sai") || withdrawing}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">You have SAI in Your Channel!</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1">
          We've transitioned the DaiCard from SAI (single-collateral DAI) to DAI (multi-collateral DAI)! Please withdraw
          the SAI from your channel in order to keep using your daicard.
        </Typography>
        <Typography variant="h6" component="p">
          Sai Balance: {saiBalance ? saiBalance.toDAI().format() : 0}
        </Typography>
        <AddressInput address={recipient} setAddress={setRecipient} />
        <Typography variant="caption">Contact us at support@connext.network with any issues!</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={withdrawSai} color="primary" variant="contained" disabled={withdrawing}>
          Withdraw SAI
        </Button>
      </DialogActions>
    </Dialog>
  );
};
