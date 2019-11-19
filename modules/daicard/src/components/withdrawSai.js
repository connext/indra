import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@material-ui/core";
import { getAddress } from "ethers/utils";
import React, { useState } from "react";

export const WithdrawSaiDialog = ({ channel, machine, saiBalance }) => {
  const [recipient, setRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const withdrawSai = async () => {
    let recipientAddress;
    try {
      recipientAddress = getAddress(recipient);
    } catch (e) {
      setRecipientError("Please enter a valid Ethereum address.");
      return;
    }
    setWithdrawing(true);
    machine.send("READY");
    machine.send("START_WITHDRAW");
    const result = await channel.withdraw({
      amount: saiBalance.toString(),
      assetId: channel.config.contractAddresses.SAIToken,
      recipient: recipientAddress,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    console.log(`Withdrawing ${saiBalance.format()} SAI to: ${recipientAddress}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  return (
    <Dialog
      open={machine.state.matches("sai") || withdrawing}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">You have SAI in Your Channel!</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1">
          We've transitioned the DaiCard from SAI (single-collateral DAI) to DAI (multi-collateral
          DAI)! Please withdraw the SAI from your channel in order to keep using your daicard.
        </Typography>
        <Typography variant="h6" component="p">
          Sai Balance: {saiBalance ? saiBalance.toDAI().format() : 0}
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          id="name"
          value={recipient}
          label="Withdrawal Address"
          onChange={event => setRecipient(event.target.value)}
          fullWidth
          variant="outlined"
          helperText={recipientError}
          error={!!recipientError}
        />
        <Typography variant="caption">
          Contact us at support@connext.network with any issues!
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={withdrawSai} color="primary" variant="contained" disabled={withdrawing}>
          Withdraw SAI
        </Button>
      </DialogActions>
    </Dialog>
  );
};
