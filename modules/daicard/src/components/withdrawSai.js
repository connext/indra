import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@material-ui/core";
import { getAddress } from "ethers/utils";
import React, { useState } from "react";

export const WithdrawSaiDialog = ({ channel, machine, saiTokenAddress, saiBalance }) => {
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
    machine.send("READY");
    machine.send("START_WITHDRAW");
    const result = await channel.withdraw({
      amount: saiBalance.toString(),
      assetId: saiTokenAddress,
      recipient: recipientAddress,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    setWithdrawing(true);
    console.log(`Withdrawing ${saiBalance.toString()} SAI to: ${recipientAddress}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  return (
    <Dialog
      open={machine.state.matches("sai")}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">You have SAI in Your Channel!</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          We've transitioned the DaiCard from SAI (single-collateral DAI) to DAI (multi-collateral
          DAI)! Please withdraw the SAI from your channel in order to keep using your daicard.
        </DialogContentText>
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
          disabled={withdrawing}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={withdrawSai} color="primary" autoFocus>
          Withdraw SAI
        </Button>
      </DialogActions>
    </Dialog>
  );
};
