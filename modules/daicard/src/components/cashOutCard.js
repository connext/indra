import {
  Button,
  CircularProgress,
  Grid,
  FormControl,
  FormHelperText,
  IconButton,
  InputBase,
  Modal,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import PropTypes from "prop-types";

import { AddressZero, Zero } from "ethers/constants";
import { arrayify, isHexString } from "ethers/utils";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useState } from "react";

import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import { inverse } from "../utils";

import { QRScan } from "./qrCode";

const styles = {
  top: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justifyContent: "center",
  },
  icon: {
    width: "40px",
    height: "40px",
    color: "#002868",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
    fontSize: "smaller",
    width: "48%",
  },
  modal: {
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    position: "absolute",
    top: "10%",
    width: "320px",
    marginLeft: "auto",
    marginRight: "auto",
    left: "0",
    right: "0",
  },
  valueInput: {
    color: "#FCA311",
    fontSize: "60px",
    cursor: "none",
    overflow: "hidden",
    paddingLeft: "31%",
  },
  helperText: {
    color: "red",
    marginTop: "-5px",
  },
  helperTextGray: {
    color: "#1E96CC",
    marginTop: "-5px",
  },
  xpubWrapper: {
    marginLeft: "5%",
    marginRight: "5%",
  },
  xpubInput: {
    width: "100%",
    color: "#FCA311",
    fontSize: "45px",
  },
  QRbutton: {
    color: "#002868",
  },
  buttonSpacer: {
    height: "10px",
    width: "100%",
  },
  cashoutWrapper: {
    justifyContent: "space-between",
  },
};

const CashoutCard = props => {
  const { balance, channel, classes, history, machine, refreshBalances, swapRate, token } = props;
  const [recipient, setRecipient] = useState({ display: "", value: undefined, error: undefined });
  const [scan, setScan] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const updateRecipientHandler = async value => {
    let newVal = value;
    let error;
    if (value.includes("ethereum:")) {
      newVal = value.split(":")[1];
    }
    if (newVal === "") {
      error = "Please provide an address";
    } else if (!isHexString(newVal)) {
      error = `Invalid hex string: ${newVal}`;
    } else if (arrayify(newVal).length !== 20) {
      error = `Invalid length: ${newVal}`;
    }
    setRecipient({
      display: value,
      value: error ? undefined : newVal,
      error,
    });
    setScan(false);
  };

  const cashoutTokens = async () => {
    const value = recipient.value;
    if (!value) return;
    const total = balance.channel.total;
    if (total.wad.lte(Zero)) return;
    // Put lock on actions, no more autoswaps until we're done withdrawing
    machine.send("START_WITHDRAW");
    setWithdrawing(true);
    console.log(`Withdrawing ${total.toETH().format()} to: ${value}`);
    const result = await channel.withdraw({
      amount: balance.channel.token.wad.toString(),
      assetId: token.address,
      recipient: value,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  const cashoutEther = async () => {
    const value = recipient.value;
    if (!value) return;
    const total = balance.channel.total;
    if (total.wad.lte(Zero)) return;
    // Put lock on actions, no more autoswaps until we're done withdrawing
    machine.send("START_WITHDRAW");
    setWithdrawing(true);
    console.log(`Withdrawing ${total.toETH().format()} to: ${value}`);
    // swap all in-channel tokens for eth
    if (balance.channel.token.wad.gt(Zero)) {
      await channel.addPaymentProfile({
        amountToCollateralize: total.toETH().wad.toString(),
        minimumMaintainedCollateral: total.toETH().wad.toString(),
        assetId: AddressZero,
        recipient: value,
      });
      await channel.requestCollateral(AddressZero);
      await channel.swap({
        amount: balance.channel.token.wad.toString(),
        fromAssetId: token.address,
        swapRate: inverse(swapRate),
        toAssetId: AddressZero,
      });
      await refreshBalances();
    }
    const result = await channel.withdraw({
      amount: balance.channel.ether.wad.toString(),
      assetId: AddressZero,
      recipient: value,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  return (
    <Grid container spacing={2} direction="column" className={classes.top}>
      {/* <Grid container wrap="nowrap" direction="row" justify="center" alignItems="center">
        <Grid item xs={12}>
          <UnarchiveIcon className={classes.icon} />
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container direction="row" justify="center" alignItems="center">
          <Typography variant="h2">
            <span>
              {balance.channel.token
                .toDAI(swapRate)
                .format({ decimals: 2, symbol: false, round: false })}
            </span>
          </Typography>
        </Grid>
      </Grid> */}
      <Grid item xs={12}>
        <Typography variant="caption">
          <span>{"Current ETH price: $" + swapRate}</span>
        </Typography>
      </Grid>
      <FormControl xs={12} className={classes.xpubWrapper}>
        <InputBase
          fullWidth
          className={classes.xpubInput}
          onChange={evt => updateRecipientHandler(evt.target.value)}
          type="text"
          value={recipient.display}
          placeholder={"Address"}
          endAdornment={
            <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
              <IconButton
                className={classes.QRButton}
                disableTouchRipple
                variant="contained"
                onClick={() => setScan(true)}
              >
                <QRIcon className={classes.icon} />
              </IconButton>
            </Tooltip>
          }
        />
        {recipient.error && (
          <FormHelperText className={classes.helperText}>{recipient.error}</FormHelperText>
        )}
      </FormControl>
      <Modal id="qrscan" open={scan} onClose={() => setScan(false)} className={classes.modal}>
        <QRScan handleResult={updateRecipientHandler} history={history} />
      </Modal>
      <Grid className={classes.buttonSpacer} />
      <Grid className={classes.buttonSpacer} />
      <Grid container direction="row" className={classes.cashoutWrapper}>
        <Button
          className={classes.button}
          disableTouchRipple
          variant="contained"
          size="large"
          color="primary"
          disabled={!recipient.value}
          onClick={cashoutEther}
        >
          Cash Out Eth
          <img src={EthIcon} style={{ width: "15px", height: "15px", marginLeft: "5px" }} alt="" />
        </Button>
        <Button
          className={classes.button}
          disableTouchRipple
          size="large"
          variant="contained"
          disabled={true}
          color="primary"
          onClick={cashoutTokens}
        >
          Cash Out Dai
          <img src={DaiIcon} style={{ width: "15px", height: "15px", marginLeft: "5px" }} alt="" />
        </Button>
      </Grid>
      <Grid item xs={12}>
        {/* <Button
          disableTouchRipple
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            width: "15%",
          }}
        >
          Back
        </Button> */}
        <Grid item xs={12} style={{ paddingTop: "10%" }}>
          {withdrawing && <CircularProgress color="primary" />}
        </Grid>
      </Grid>
    </Grid>
  );
};

CashoutCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(CashoutCard);
