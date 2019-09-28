import { Button, Grid, TextField, Typography, withStyles } from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useEffect, useState } from "react";

import { Currency } from "../utils";

import { Copyable } from "./copyable";
import { QRGenerate } from "./qrCode";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
}));

const zero = "0.0"
const generateQrUrl = (amount, xpub) =>
  `${window.location.origin}/send?amount=${amount || zero}&recipient=${xpub}`;

export const RequestCard = style((props) => {
  const { maxDeposit, xpub } = props;

  const [amount, setAmount] = useState({ value: Currency.DAI(zero), display: "0" });
  const [qrUrl, setQrUrl] = useState(generateQrUrl(zero, xpub));

  useEffect(() => setQrUrl(generateQrUrl(amount.value, xpub)), [xpub]);

  const updateAmountHandler = (input) => {
    let value, error
    try {
      value = Currency.DAI(input)
    } catch (e) {
      error = `Invalid Currency amount`
    }
    if (value && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`
    }
    if (value && value.wad.lt(Zero)) {
      error = "Please enter a payment amount above 0"
    }
    setQrUrl(generateQrUrl(error ? zero : value.amount, xpub));
    setAmount({ value: value ? value.toString() : zero, display: input, error });
  };

  return (
    <Grid
      container
      spacing={2}
      direction="column"
      style={{
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
        justifyContent: "center"
      }}
    >

      <Typography>Payment Request Url:</Typography>
      <Grid item xs={12}>
        <QRGenerate value={qrUrl} />
      </Grid>
      <Copyable
        text={amount.error ? 'error' : qrUrl}
        tooltip={amount.error ? "Fix amount first" : "Click to Copy"}
      />

      <Grid item xs={12}>
        <TextField
          fullWidth
          id="outlined-number"
          label="Amount"
          value={amount.display}
          type="number"
          variant="outlined"
          onChange={evt => updateAmountHandler(evt.target.value)}
          error={!!amount.error}
          helperText={amount.error}
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            width: "15%"
          }}
          size="medium"
          onClick={() => props.history.push("/")}
        >
          Back
        </Button>
      </Grid>
    </Grid>
  );
});
