import { Button,FormControl, FormHelperText, Grid, InputBase, TextField, Typography, withStyles } from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import { Currency } from "../utils";

import Copyable from "./copyable";
import { QRGenerate } from "./qrCode";

const styles = {
  top: {
    paddingLeft: "10%",
    paddingRight: "10%",
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justifyContent: "center",
  },
  icon: {
    width: "40px",
    height: "40px",
  },
  bodyContainer: {
    marginTop: "5px",
    marginBottom:"5px"
  },
  bodyForm:{
    width:"100%",
    alignItems:"center",
    justifyContent:"center"
  },
  bodyLink:{
    width:"100%",
    alignItems:"center",
    justifyContent:"center"
  },
  copyable:{
    width:"225px"
  },
  valueInput: {
    color: "#FCA311",
    fontSize: "60px",
    cursor: "none",
    overflow:"hidden",
    paddingLeft:"31%"
  },
  helperText:{
    color:"red",
    marginTop:"-5px"
  }
};

const zero = "0.0";
const generateQrUrl = (amount, xpub) =>
  `${window.location.origin}/send?amount=${amount || zero}&recipient=${xpub}`;

const RequestCard = props => {
  const { classes, maxDeposit, xpub, match } = props;

  console.log(xpub)


  const [amount, setAmount] = useState({ value: match.params.amount? match.params.amount:Currency.DAI(zero), display: match.params.amount? match.params.amount:"0.00"});
  const [qrUrl, setQrUrl] = useState(generateQrUrl(zero, xpub));

  useEffect(() => setQrUrl(generateQrUrl(amount.value, xpub)), [amount.value, xpub]);

  const updateAmountHandler = input => {
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
    setQrUrl(generateQrUrl(error ? zero : value.amount, xpub));
    setAmount({ value: value ? value.amount : zero, display: input, error });
  };

  console.log(match.params.amount)
  console.log(amount.display)


  return (
    <Grid container spacing={2} direction="column" className={classes.top}>
      <FormControl xs={12} className={classes.bodyForm}>
        <InputBase
            required
            className={classes.valueInput}
            onChange={evt => updateAmountHandler(evt.target.value)}
            type="numeric"
            value={amount.display}
            placeholder={"0.00"}
          />
          {amount.error && <FormHelperText className={classes.helperText}>{amount.error}</FormHelperText>}
      </FormControl>

      <Grid item xs={12} className={classes.bodyContainer}>
        <QRGenerate value={qrUrl} size={225}/>
      </Grid>
      <Grid container className={classes.bodyLink}>
          <Copyable className={classes.copyable} text={amount.error ? "error" : qrUrl} wrap={true} />
      </Grid>

      {/* <Grid item xs={12} className={classes.bodyContainer}>
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
      </Grid> */}
    </Grid>
  );
};

RequestCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(RequestCard);


//<Grid container>
//<Grid item xs={4}>
//  <Typography>Channel ID:</Typography>
//</Grid>
//<Grid item xs={8}>
//  <Copyable text={xpub} />
//</Grid>
//</Grid>