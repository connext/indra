import {
  Button,
  Fab,
  Grid,
  Modal,
  InputBase,
  IconButton,
  InputAdornment,
  TextField,
  withStyles,
  Typography,
  Tooltip,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { SaveAlt as ReceiveIcon, Send as SendIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Currency } from "../utils";
import { Zero } from "ethers/constants";
import DirectionProvider, { DIRECTIONS } from "react-with-direction/dist/DirectionProvider";

import "../App.css";

import { ChannelCard } from "./channelCard";
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
    width: "375px",
    marginLeft: "auto",
    marginRight: "auto",
    left: "0",
    right: "0",
  },
  button: {
    color: "#FFF",
  },
  buttonOutlined: {
    color: "#FCA311",
  },
  buttonSpacer: {
    height: "10px",
  },
  QRbutton: {
    color: "#002868",
  },
  icon: {
    color: "#002868",
  },
  buttonIcon: {
    marginLeft: "5px",
  },
  valueInput: {
    width: "100%",
    color: "#FCA311",
    fontSize: "60px",
    textAlign: "right",
    cursor: "none",
  },
  valueInputWrapper: {
    display: "flex",
    marginTop: "15%",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: "30%",
  },
};

function Home(props) {
  const [scanModal, setScanModal] = useState(false);
  const [amount, setAmount] = useState({ display: "", error: null, value: "" });
  const [recipient, setRecipient] = useState({ display: "", error: null, value: null });

  const { classes, balance, swapRate } = props;

  const scanQRCode = async data => {
    const path = await props.scanQRCode(data);
    setScanModal(false);
    props.history.push(path);
  };

  const tokenBalance = balance.channel.token.wad;

  const updateAmountHandler = useCallback(
    rawValue => {
      let valueFormatted;
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
      <Grid container direction="row" className={classes.valueInputWrapper}>
        <InputBase
          required
          fullWidth
          className={classes.valueInput}
          error={amount.error !== null}
          onChange={evt => updateAmountHandler(evt.target.value)}
          type="numeric"
          value={amount.display}
          placeholder={"0.00"}
        />
      </Grid>
      <Grid container direction="row" style={{ marginTop: "2%" }}>
        <Grid item xs={12} style={{ marginLeft: "5%", marginRight: "5%" }}>
          <InputBase
            fullWidth
            error={amount.error !== null}
            onChange={evt => updateRecipientHandler(evt.target.value)}
            style={{ width: "100%", color: "#FCA311", fontSize: "45px" }}
            error={recipient.error !== null}
            type="text"
            value={recipient.display}
            placeholder={"xPub"}
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
          <Modal
            id="qrscan"
            open={scanModal}
            onClose={() => setScanModal(false)}
            className={classes.modal}
          >
            <QRScan handleResult={scanQRCode} />
          </Modal>
        </Grid>
      </Grid>
      <Grid container spacing={0} direction="column">
        <Grid className={classes.buttonSpacer} />
        <Button
          className={classes.button}
          disableTouchRipple
          color="primary"
          fullWidth
          variant="contained"
          size="large"
          component={Link}
          to={`/request/${amount.display}`}
        >
          Request
          <ReceiveIcon className={classes.buttonIcon} />
        </Button>
        <Grid className={classes.buttonSpacer} />
        <Button
          className={classes.button}
          disableTouchRipple
          color="primary"
          fullWidth
          size="large"
          variant="contained"
          component={Link}
          to={`/send/${amount.display}/${recipient.display}`}
        >
          Send
          <SendIcon className={classes.buttonIcon} />
        </Button>
        <Grid className={classes.buttonSpacer} />

        <Button
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
