import {
  FormControl,
  FormHelperText,
  Grid,
  InputBase,
  withStyles,
} from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import { Currency } from "../utils";

import Copyable from "./copyable";
import { AmountInput, useAmount } from "./input";
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
    marginBottom: "5px",
  },
  bodyForm: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  bodyLink: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  copyable: {
    width: "225px",
  },
  valueInput: {
    color: "#FCA311",
    fontSize: "60px",
    cursor: "none",
    overflow: "hidden",
    width:"100%",
    alignItems:"center",
    justifyContent:"center"
  },
  valueInputInner:{
    textAlign:"center",
    margin:"auto"
  },
  helperText: {
    color: "red",
    marginTop: "-5px",
  },
};


const RequestCard = props => {
  const { classes, maxDeposit, xpub, match } = props;
  const [amount, setAmount] = useAmount(null, maxDeposit, Currency.DEI("0")); 
  const [qrUrl, setQrUrl] = useState("");

  const amountStr = (amount && amount.value && amount.value.amount) ? amount.value.amount : "0.0";
  const generateQrUrl = (amount, xpub) =>
    `${window.location.origin}/send?amount=${amount}&recipient=${xpub}`;

  useEffect(() => {
    if (match && match.params && match.params.amount) {
      setAmount(match.params.amount);
    }
  }, []);
  useEffect(() => {
    setQrUrl(generateQrUrl(amountStr, xpub));
  }, [amountStr, xpub]);

  return (
    <Grid container spacing={2} direction="column" className={classes.top}>
      <AmountInput amount={amount} setAmount={setAmount} />
      <Grid item xs={12} className={classes.bodyContainer}>
        <QRGenerate value={qrUrl} size={225} />
      </Grid>
      <Grid container className={classes.bodyLink}>
        <Copyable className={classes.copyable} text={amount.error ? "error" : qrUrl} wrap={true} />
      </Grid>
    </Grid>
  );
};

RequestCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(RequestCard);
