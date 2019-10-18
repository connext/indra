import {
  Button,
  Fab,
  Grid,
  Modal,
  InputBase,
  InputAdornment,
  TextField,
  withStyles,
  Typography,
  Tooltip,
} from "@material-ui/core";
import { SaveAlt as ReceiveIcon, Send as SendIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Currency } from "../utils";
import { Zero } from "ethers/constants";

import "../App.css";

import { ChannelCard } from "./channelCard";
import { QRScan } from "./qrCode";

const style = withStyles(theme => ({
  top: {
    display: "flex",
    flexDirection: "column",
  },
  modal: {
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
  },
}));

export const Home = style(props => {
  const [scanModal, setScanModal] = useState(false);
  const [amount, setAmount] = useState({ display: "", error: null, value: null });
  const [recipient, setRecipient] = useState({ display: "", error: null, value: null });

  const { balance, swapRate } = props;

  const scanQRCode = async data => {
    const path = await props.scanQRCode(data);
    setScanModal(false);
    props.history.push(path);
  };

  const tokenBalance = balance.channel.token.wad;

  const updateAmountHandler = useCallback(
    rawValue => {
      let value = null;
      let error = null;
      if (!rawValue) {
        error = `Invalid amount: must be greater than 0`;
      }
      if (!error) {
        try {
          value = Currency.DAI(rawValue);
        } catch (e) {
          error = `Please enter a valid amount`;
        }
      }
      if (!error && value && value.wad.gt(tokenBalance)) {
        error = `Invalid amount: must be less than your balance`;
      }
      if (!error && value && value.wad.lte(Zero)) {
        error = "Invalid amount: must be greater than 0";
      }
      setAmount({
        display: rawValue,
        error,
        value: error ? null : value,
      });
    },
    [tokenBalance],
  );

  const updateRecipientHandler = rawValue => {
    const xpubLen = 111;
    let value = null;
    let error = null;
    value = rawValue;
    if (!value || !value.startsWith("xpub")) {
      error = "Invalid recipient: should start with xpub";
    }
    if (!error && value.length !== xpubLen) {
      error = `Invalid recipient: expected ${xpubLen} characters, got ${value.length}`;
    }
    setRecipient({
      display: rawValue,
      error,
      value: error ? null : value,
    });
  };

  return (
    <Grid container className={style.top}>
      <Grid
        container
        direction="row"
        alignItems="center"
        justify="center"
        style={{ marginTop: "20%" }}
      >
        <Grid item xs={4} style={{ marginLeft: "8%" }}>
          <InputBase
            required
            fullWidth
            // startAdornment={<Typography style={{fontSize:"45px"}}>$</Typography>}
            error={amount.error !== null}
            helperText={amount.error}
            onChange={evt => updateAmountHandler(evt.target.value)}
            style={{ width: "100%", color: "#FCA311", fontSize: "60px", textAlign: "center" }}
            type="number"
            value={amount.display}
            placeholder={"0.00"}
          />
        </Grid>
      </Grid>
      <Grid container direction="row" spacing={10} style={{ marginTop: "2%" }}>
        <Grid item xs={12} style={{ marginLeft: "5%", marginRight: "5%" }}>
          <InputBase
            fullWidth
            error={amount.error !== null}
            helperText={amount.error}
            onChange={evt => updateRecipientHandler(evt.target.value)}
            style={{ width: "100%", color: "#FCA311", fontSize: "45px" }}
            error={recipient.error !== null}
            type="text"
            value={recipient.display}
            placeholder={"xPub"}
            endAdornment={
              <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                <Button
                  disableTouchRipple
                  variant="contained"
                  style={{ backgroundColor: "#002868", color: "#FFF" }}
                  onClick={() => setScanModal(true)}
                >
                  <QRIcon />
                </Button>
              </Tooltip>
            }
          />
          <Modal
            id="qrscan"
            open={scanModal}
            onClose={() => setScanModal(false)}
            className={style.modal}
          >
            <QRScan handleResult={scanQRCode} />
          </Modal>
        </Grid>
      </Grid>
      <Grid container spacing={4} direction="column" style={{ textAlign: "center" }}>
          <Grid item sm={12} xs={12}>
            <Button
              disableTouchRipple
              fullWidth
              style={{
                color: "#FFF",
                backgroundColor: "#FCA311",
              }}
              variant="contained"
              size="large"
              component={Link}
              to={`/request/${amount.display}`}
            >
              Request
              <ReceiveIcon style={{ marginLeft: "5px" }} />
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              disableTouchRipple
              fullWidth
              style={{
                color: "#FFF",
                backgroundColor: "#FCA311",
              }}
              size="large"
              variant="contained"
              component={Link}
              to={`/send/${amount.display}/${recipient.display}`}
            >
              Send
              <SendIcon style={{ marginLeft: "5px" }} />
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              disableTouchRipple
              style={{}}
              fullWidth
              color="primary"
              variant="outlined"
              size="large"
              component={Link}
              to="/cashout"
            >
              Cash Out
            </Button>
        </Grid>
      </Grid>
    </Grid>
  );
});
