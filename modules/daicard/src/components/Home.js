import {
  Button,
  Fab,
  Grid,
  Modal,
  withStyles,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { SaveAlt as ReceiveIcon, Send as SendIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Currency, initWalletConnect } from "../utils";

import "../App.css";

import ChannelCard from "./channelCard";
import { QRScan } from "./qrCode";

const LINK_LIMIT = Currency.DAI("10"); // $10 capped linked payments

const formatAmountString = amount => {
  const [whole, part] = amount.split(".");
  return `${whole || "0"}.${part ? part.padEnd(2, "0") : "00"}`;
};

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
  startAdornment: {
    marginLeft: "10%",
    fontSize: "40px",
  },
  helperText: {
    color: "red",
    marginTop: "-5px",
    alignSelf: "center",
    textAlign: "center",
  },
  helperTextGray: {
    color: "#1E96CC",
    marginTop: "-5px",
    alignSelf: "center",
    textAlign: "center",
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
  linkButtonInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "5px",
  },
  linkSub: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: "-5px",
    width: "100%",
  },
  sendCardModalWrap: {
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  sendCardModalGrid: { backgroundColor: "#FFF", paddingTop: "10%", paddingBottom: "10%" },
  dialogText: {
    color: "#FCA311",
    margin: "1em",
  },
  dialogTextRed: {
    color: "#F22424",
    margin: "1em",
  },
  linkSendWrapper: {
    justifyContent: "space-between",
  },
};

function Home(props) {
  const { classes, balance, history, network, parseQRCode, swapRate } = props;
  const [scanModal, setScanModal] = useState(false);
  return (
    <Grid container className={classes.top}>
      <Modal
        id="qrscan"
        open={scanModal}
        onClose={() => setScanModal(false)}
        className={classes.modal}
      >
        <QRScan handleResult={(data) => {
          setScanModal(false);
          history.push(parseQRCode(data));
        }}/>
      </Modal>
      <Grid container spacing={0} direction="column" style={{ margin: "1em 0 3em 0" }}>
        <ChannelCard
          big={true}
          balance={balance}
          swapRate={swapRate}
          network={network}
        />
      </Grid>
      <Grid container spacing={0} direction="column">
        <Grid item>
          <Fab
            style={{
              float: "right",
              color: "#FFF",
              backgroundColor: "#fca311",
              size: "large",
            }}
            onClick={() => setScanModal(true)}
          >
            <QRIcon />
          </Fab>
        </Grid>
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
              to={"/request"}
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
              to="/send"
            >
              Send
              <SendIcon className={classes.buttonIcon} />
            </Button>
          </Grid>
         <Grid className={classes.buttonSpacer} />
           <Grid>
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
    </Grid>
  );
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Home);
