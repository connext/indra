import { Button, Grid, TextField, withStyles } from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useState } from "react";

import { Currency } from "../utils";

import { Copyable } from "./copyable";
import { QRGenerate } from "./qrCode";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
}));

const generateQrUrl = (value, xpub) =>
  `${window.location.origin}/send?amountToken=${value || "0"}&recipient=${xpub}`;

export const RequestCard = style((props) => {
  const { maxDeposit, xpub } = props;

  const [displayValue, setDisplayValue] = useState("");
  const [error, setError] = useState(undefined);
  const [qrUrl, setQrUrl] = useState(generateQrUrl("0", xpub));

  const updatePaymentHandler = (rawValue) => {
    let value, error
    try {
      value = Currency.DAI(rawValue)
    } catch (e) {
      error = e.message
    }
    if (value && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`
    }
    if (value && value.wad.lte(Zero)) {
      error = "Please enter a payment amount above 0"
    }
    setQrUrl(generateQrUrl(error ? "0" : value.amount, xpub));
    setDisplayValue(rawValue);
    setError(error);
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
      <Grid item xs={12}>
        <QRGenerate value={qrUrl} />
      </Grid>

      <Copyable text={xpub} />

      <Copyable
        text={error ? 'error' : qrUrl}
        tooltip={error ? "Fix amount first" : "Click to Copy"}
      />

      <Grid item xs={12}>
        <TextField
          fullWidth
          id="outlined-number"
          label="Amount"
          value={displayValue}
          type="number"
          margin="dense"
          variant="outlined"
          onChange={evt => updatePaymentHandler(evt.target.value)}
          error={!!error}
          helperText={error}
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
