import {
  Button,
  Grid,
  Modal,
  FormControl,
  FormHelperText,
  InputBase,
  IconButton,
  withStyles,
  Tooltip,
  Typography
} from "@material-ui/core";
import PropTypes from "prop-types";
import { SaveAlt as ReceiveIcon, Send as SendIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Currency, initWalletConnect } from "../utils";
import { Zero } from "ethers/constants";
import MaskedInput from 'react-text-mask';


import "../App.css";

import { QRScan } from "./qrCode";

const styles = {
  top: {
    display: "flex",
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    alignSelf: "center",
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
  requestSendWrapper: {
    justifyContent: "space-between",
  },
  button: {
    color: "#FFF",
    width: "48%",
  },
  buttonOutlined: {
    color: "#FCA311",
  },
  buttonSpacer: {
    height: "10px",
  },
  QRbutton: {
    color: "#fca311",
  },
  icon: {
    color: "#fca311",
  },
  buttonIcon: {
    marginLeft: "5px",
  },
  valueInput: {
    color: "#FCA311",
    fontSize: "60px",
    cursor: "none",
    overflow: "hidden",
    width: "50%",
  },
  valueInputInner: {
    textAlign: "center",
    margin: "auto",
  },
  valueInputWrapper: {
    marginTop: "15%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    // paddingLeft: "30%",
  },
  startAdornment:{
    marginLeft:"10%",
    fontSize:"40px"
  },
  helperText: {
    color: "red",
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
  xpubInputInner: {
    textAlign: "center",
    margin: "auto",
  },
};



function Home(props) {
  const [scanModal, setScanModal] = useState(false);
  const [amount, setAmount] = useState({ display: "", error: null, value: "" });
  const [recipient, setRecipient] = useState({ display: "", error: null, value: null });

  const { classes, balance, channel, history } = props;

  const scanQRCode = async data => {
    setScanModal(false);
    if (data.startsWith("wc:")) {
      await initWalletConnect(data, channel);
    } else {
      history.push(data);
    }
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
    <Grid container className={classes.top}>
      <Modal
        id="qrscan"
        open={scanModal}
        onClose={() => setScanModal(false)}
        className={classes.modal}
      >
        <QRScan handleResult={scanQRCode} />
      </Modal>
      <FormControl className={classes.valueInputWrapper}>
        <InputBase
          required
          fullWidth={true}
          className={classes.valueInput}
          classes={{ input: classes.valueInputInner }}
          error={amount.error !== null}
          onChange={evt => updateAmountHandler(evt.target.value.replace("$",""))}
          type="numeric"
          value={amount.display === "" ? null : "$"+amount.display}
          placeholder={"$0.00"}
          // startAdornment={<Typography className={classes.startAdornment}>$</Typography>}
        />

        {amount.error && (
          <FormHelperText className={classes.helperText}>{amount.error}</FormHelperText>
        )}
      </FormControl>
      <Grid item xs={12} className={classes.xpubWrapper}>
        <InputBase
          fullWidth
          className={classes.xpubInput}
          classes={{ input: classes.xpubInputInner }}
          error={amount.error !== null && recipient.error !== null}
          onChange={evt => updateRecipientHandler(evt.target.value)}
          type="text"
          value={recipient.display}
          placeholder={"Recipient"}
          endAdornment={
            <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
              <IconButton
                className={classes.QRButton}
                disableTouchRipple
                variant="contained"
                onClick={() => setScanModal(true)}
              >
                <QRIcon className={classes.icon} />
              </IconButton>
            </Tooltip>
          }
        />
      </Grid>
      <Grid container spacing={0} direction="column">
        <Grid className={classes.buttonSpacer} />
        <Grid className={classes.buttonSpacer} />
        <Grid container directiom="row" className={classes.requestSendWrapper}>
          <Button
            id="goToRequestButton"
            className={classes.button}
            disableTouchRipple
            color="primary"
            variant="contained"
            size="large"
            component={Link}
            to={`/request${amount.display ? `?amount=${amount.display}` : ""}`}
          >
            Request
            <ReceiveIcon className={classes.buttonIcon} />
          </Button>
          <Grid className={classes.buttonSpacer} />
          <Button
            id="goToSendButton"
            className={classes.button}
            disableTouchRipple
            color="primary"
            size="large"
            variant="contained"
            component={Link}
            to={`/send${amount.display || recipient.display ? "?" : ""}${
              amount.display ? `amount=${amount.display}` : ""
            }${amount.display && recipient.display ? "&" : ""}${
              recipient.display ? `recipient=${recipient.display}` : ""
            }`}
          >
            Send
            <SendIcon className={classes.buttonIcon} />
          </Button>
        </Grid>
        <Grid className={classes.buttonSpacer} />
        <Button
          id="goToDepositButton"
          className={classes.buttonOutlined}
          disableTouchRipple
          fullWidth
          color="primary"
          variant="outlined"
          size="large"
          component={Link}
          to="/deposit"
        >
          Deposit
        </Button>
        <Grid className={classes.buttonSpacer} />
        <Button
          id="goToCashoutButton"
          className={classes.buttonOutlined}
          disableTouchRipple
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
  );
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Home);
