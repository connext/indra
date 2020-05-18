import { Currency } from "@connext/utils";
import { Button, Grid, TextField, Typography, withStyles } from "@material-ui/core";
import { constants } from "ethers";
import React, { useEffect, useState } from "react";

import { Copyable } from "./copyable";
import { QRGenerate } from "./qrCode";

const { Zero } = constants;

const style = withStyles((theme) => ({
  icon: {
    width: "40px",
    height: "40px",
  },
}));

const zero = "0.0";
const generateQrUrl = (amount, publicId) =>
  `${window.location.origin}/send?amount=${amount || zero}&recipient=${publicId}`;

export const RequestCard = style((props) => {
  const { maxDeposit, publicId } = props;

  const [amount, setAmount] = useState({ value: Currency.DAI(zero), display: "0" });
  const [qrUrl, setQrUrl] = useState(generateQrUrl(zero, publicId));

  useEffect(() => setQrUrl(generateQrUrl(amount.value, publicId)), [amount.value, publicId]);

  const updateAmountHandler = (input) => {
    let value, error;
    try {
      value = Currency.DAI(input);
    } catch (e) {
      error = `Invalid Currency amount`;
    }
    if (!maxDeposit) {
      error = `Channels are still starting up, please wait.`;
    }
    if (value && maxDeposit && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`;
    }
    if (value && value.wad.lt(Zero)) {
      error = "Please enter a payment amount above 0";
    }
    setQrUrl(generateQrUrl(error ? zero : value.amount, publicId));
    setAmount({ value: value ? value.amount : zero, display: input, error });
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
        justifyContent: "center",
      }}
    >
      <Grid container>
        <Grid item xs={4}>
          <Typography style={{ marginTop: "6px" }}>Channel ID:</Typography>
        </Grid>
        <Grid item xs={8}>
          <Copyable text={publicId} />
        </Grid>
      </Grid>

      <Grid container style={{ marginTop: "12px" }}>
        <Grid item xs={4}>
          <Typography style={{ marginTop: "6px" }}>Request Link:</Typography>
        </Grid>
        <Grid item xs={8}>
          <Copyable text={amount.error ? "error" : qrUrl} />
        </Grid>
      </Grid>

      <Grid item xs={12} style={{ margin: "12px" }}>
        <QRGenerate value={qrUrl} size={225} />
      </Grid>

      <Grid item xs={12} style={{ width: "100%", padding: "0px" }}>
        <TextField
          fullWidth
          id="outlined-number"
          label="Amount"
          value={amount.display}
          type="number"
          variant="outlined"
          onChange={(evt) => updateAmountHandler(evt.target.value)}
          error={!!amount.error}
          helperText={amount.error}
        />
      </Grid>

      <Grid item xs={12} style={{ marginTop: "12px" }}>
        <Button
          disableTouchRipple
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            width: "15%",
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
