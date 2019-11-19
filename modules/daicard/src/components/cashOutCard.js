import {
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  Modal,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Unarchive as UnarchiveIcon } from "@material-ui/icons";
import { AddressZero, Zero } from "ethers/constants";
import { arrayify, isHexString } from "ethers/utils";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useEffect, useState } from "react";

import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import { inverse } from "../utils";

import { QRScan } from "./qrCode";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
    fontSize: "smaller",
  },
  modal: {
    position: "absolute",
    top: "-400px",
    left: "150px",
    width: theme.spacing(50),
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(4),
    outline: "none",
  },
}));

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay)
    return () => clearTimeout(handler);
  }, [value]);
  return debouncedValue;
}

const useAddress = (address, ethProvider, network, setScan) => {
  const [recipientDisplay, setRecipientDisplay] = useState(null);
  const [recipientValue, setRecipientValue] = useState(null);
  const [recipientError, setRecipientError] = useState(null);
  const debouncedRecipient = useDebounce(recipientDisplay, 1000);
  useEffect(() => {
    (async () => {
      if (debouncedRecipient === null) return;
      let newVal = debouncedRecipient;
      let error;
      if (debouncedRecipient.startsWith("ethereum:")) {
        newVal = debouncedRecipient.split(":")[1];
      }
      if (network.ensAddress && newVal.endsWith('.eth')) {
        newVal = await ethProvider.resolveName(newVal);
      }
      if (newVal === "") {
        error = "Please provide an address or ens name";
      } else if (!isHexString(newVal)) {
        error = `Invalid hex string`;
      } else if (arrayify(newVal).length !== 20) {
        error = `Invalid length: ${newVal.length} (expected 42)`;
      }
      setRecipientValue(error ? undefined : newVal);
      setRecipientError(error);
      setScan(false);
    })()
  }, [debouncedRecipient]);
  const setAddress = setRecipientDisplay;
  return ([{ display: recipientDisplay, value: recipientValue, error: recipientError }, setAddress]);
}

export const CashoutCard = style(({
  balance, channel, classes, ethProvider, history, machine, network, refreshBalances, swapRate, token,
}) => {
    const [scan, setScan] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [recipient, setRecipient] = useAddress(null, ethProvider, network, setScan);

    const cashoutTokens = async () => {
      const value = recipient.value;
      if (!channel || !value) return;
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
      if (!channel || !value) return;
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
      <Grid
        container
        spacing={2}
        direction="column"
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justifyContent: "center",
        }}
      >
        <Grid container wrap="nowrap" direction="row" justify="center" alignItems="center">
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
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption">
            <span>{"ETH price: $" + swapRate}</span>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            style={{ width: "100%" }}
            id="outlined-with-placeholder"
            label="Address"
            placeholder="0x0..."
            value={recipient.display || ""}
            onChange={evt => setRecipient(evt.target.value)}
            margin="normal"
            variant="outlined"
            required
            helperText={recipient.error}
            error={!!recipient.error}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                    <Button
                      disableTouchRipple
                      variant="contained"
                      color="primary"
                      style={{ color: "primary" }}
                      onClick={() => setScan(true)}
                    >
                      <QRIcon />
                    </Button>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Modal
          id="qrscan"
          open={scan}
          onClose={() => setScan(false)}
          style={{
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            position: "absolute",
            top: "10%",
            width: "375px",
            marginLeft: "auto",
            marginRight: "auto",
            left: "0",
            right: "0",
          }}
        >
          <QRScan handleResult={setRecipient} history={history} />
        </Modal>
        <Grid item xs={12}>
          <Grid container spacing={8} direction="row" alignItems="center" justify="center">
            <Grid item xs={6}>
              <Button
                disableTouchRipple
                className={classes.button}
                fullWidth
                onClick={cashoutEther}
                disabled={!recipient.value}
              >
                Cash Out Eth
                <img
                  src={EthIcon}
                  style={{ width: "15px", height: "15px", marginLeft: "5px" }}
                  alt=""
                />
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                disableTouchRipple
                className={classes.button}
                variant="contained"
                fullWidth
                onClick={cashoutTokens}
                disabled={!recipient.value}
              >
                Cash Out Dai
                <img
                  src={DaiIcon}
                  style={{ width: "15px", height: "15px", marginLeft: "5px" }}
                  alt=""
                />
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
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
            onClick={() => history.push("/")}
          >
            Back
          </Button>
          <Grid item xs={12} style={{ paddingTop: "10%" }}>
            {withdrawing && <CircularProgress color="primary" />}
          </Grid>
        </Grid>
      </Grid>
    );
  },
);
