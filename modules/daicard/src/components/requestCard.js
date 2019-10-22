import { Button, Grid, TextField, Typography, withStyles } from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useEffect, useState } from "react";
import PropTypes from 'prop-types';

import { Currency } from "../utils";

import { Copyable } from "./copyable";
import { QRGenerate } from "./qrCode";

const styles = {
  top:{
    paddingLeft: "10%",
    paddingRight: "10%",
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justifyContent: "center"
  },
  icon: {
    width: "40px",
    height: "40px"
  },
  bodyContainer:{
    marginTop:"12px"
  }
};

const zero = "0.0"
const generateQrUrl = (amount, xpub) =>
  `${window.location.origin}/send?amount=${amount || zero}&recipient=${xpub}`;

const RequestCard = props => {
  const { classes, maxDeposit, xpub, match } = props;

  const [amount, setAmount] = useState({ value: Currency.DAI(zero), display: "0" });
  const [qrUrl, setQrUrl] = useState(generateQrUrl(zero, xpub));

  useEffect(() => setQrUrl(generateQrUrl(amount.value, xpub)), [amount.value, xpub]);

  const updateAmountHandler = (input) => {
    let value, error
    try {
      value = Currency.DAI(input)
    } catch (e) {
      error = `Invalid Currency amount`
    }
    if (!maxDeposit) {
      error = `Channels are still starting up, please wait.`
    }
    if (value && maxDeposit && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`
    }
    if (value && value.wad.lt(Zero)) {
      error = "Please enter a payment amount above 0"
    }
    setQrUrl(generateQrUrl(error ? zero : value.amount, xpub));
    setAmount({ value: value ? value.amount : zero, display: input, error });
  };

  return (
    <Grid
      container
      spacing={2}
      direction="column"
      className={classes.top}
    >
      <Grid container>
        <Grid item xs={4}>
          <Typography>Channel ID:</Typography>
        </Grid>
        <Grid item xs={8}>
          <Copyable text={xpub}/>
        </Grid>
      </Grid>

      <Grid container className={classes.bodyContainer}>
        <Grid item xs={4}>
          <Typography style={{ marginTop: "6px" }}>Request Link:</Typography>
        </Grid>
        <Grid item xs={8}>
          <Copyable text={amount.error ? 'error' : qrUrl}/>
        </Grid>
      </Grid>

      <Grid item xs={12} className={classes.bodyContainer}>
        <QRGenerate value={qrUrl} size={225} />
      </Grid>

      <Grid item xs={12} className={classes.bodyContainer}>
        <TextField
          fullWidth
          id="outlined-number"
          label="Amount"
          value={amount.display? amount.display:match.params.amount}
          type="number"
          variant="outlined"
          onChange={evt => updateAmountHandler(evt.target.value)}
          error={!!amount.error}
          helperText={amount.error}
        />
      </Grid>

      <Grid item xs={12} className={classes.bodyContainer}>
        <Button
          disableTouchRipple
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
};

RequestCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(RequestCard);

