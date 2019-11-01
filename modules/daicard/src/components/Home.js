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
  Typography,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { SaveAlt as ReceiveIcon, Send as SendIcon, Link as LinkIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Currency, initWalletConnect, toBN } from "../utils";
import { Zero } from "ethers/constants";
import MaskedInput from "react-text-mask";
import { useMachine } from "@xstate/react";
import { sendMachine } from "../state";
import { hexlify, randomBytes } from "ethers/utils";

import Copyable from "./copyable";

import "../App.css";

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
  const [scanModal, setScanModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [amount, setAmount] = useState({ display: "", error: null, value: "" });
  const [recipient, setRecipient] = useState({ display: "", error: null, value: null });
  const [link, setLink] = useState(undefined);
  const [paymentState, paymentAction] = useMachine(sendMachine);

  const { classes, balance, channel, history, token } = props;

  const scanQRCode = async data => {
    setScanModal(false);
    if (data.startsWith("wc:")) {
      await initWalletConnect(data, channel);
    } else {
      history.push(data);
    }
  };

  const tokenBalance = balance.channel.token.wad;

  const closeModal = () => {
    paymentAction("DISMISS");
  };

  const paymentHandler = async () => {
    if (amount.error || recipient.error) return;
    if (!recipient.value) {
      setRecipient({
        ...recipient,
        error: "Recipent must be specified for p2p transfer",
      });
      return;
    }
    console.log(`Sending ${amount.value} to ${recipient.value}`);
    paymentAction("NEW_P2P");
    // there is a chance the payment will fail when it is first sent
    // due to lack of collateral. collateral will be auto-triggered on the
    // hub side. retry for 1min, then fail
    const endingTs = Date.now() + 60 * 1000;
    let transferRes = undefined;
    while (Date.now() < endingTs) {
      try {
        transferRes = await channel.conditionalTransfer({
          assetId: token.address,
          amount: amount.value.wad.toString(),
          conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
          paymentId: hexlify(randomBytes(32)),
          preImage: hexlify(randomBytes(32)),
          recipient: recipient.value,
        });
        break;
      } catch (e) {
        await new Promise(res => setTimeout(res, 5000));
      }
    }
    if (!transferRes) {
      paymentAction("ERROR");
      return;
    }
    paymentAction("DONE");
  };

  const linkHandler = async () => {
    if (amount.error) return;
    if (recipient.error && !recipient.value) {
      setRecipient({ ...recipient, error: null });
    }
    if (toBN(amount.value.toDEI()).gt(LINK_LIMIT.wad)) {
      setAmount({ ...amount, error: `Linked payments are capped at ${LINK_LIMIT.format()}.` });
      return;
    }
    paymentAction("NEW_LINK");
    try {
      console.log(`Creating ${amount.value.format()} link payment`);
      const link = await channel.conditionalTransfer({
        assetId: token.address,
        amount: amount.value.wad.toString(),
        conditionType: "LINKED_TRANSFER",
        paymentId: hexlify(randomBytes(32)),
        preImage: hexlify(randomBytes(32)),
      });
      console.log(`Created link payment: ${JSON.stringify(link, null, 2)}`);
      console.log(
        `link params: secret=${link.preImage}&paymentId=${link.paymentId}&` +
          `assetId=${token.address}&amount=${amount.value.amount}`,
      );
      paymentAction("DONE");
      setLink({
        baseUrl: `${window.location.origin}/redeem`,
        paymentId: link.paymentId,
        secret: link.preImage,
      });
    } catch (e) {
      console.warn("Unexpected error creating link payment:", e);
      paymentAction("ERROR");
    }
  };

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
      <SendCardModal
        amount={amount.display ? amount.display : "0"}
        classes={classes}
        closeModal={closeModal}
        history={history}
        link={link}
        paymentState={paymentState}
        recipient={recipient.value}
      />
      <FormControl className={classes.valueInputWrapper}>
        <InputBase
          required
          fullWidth={true}
          className={classes.valueInput}
          classes={{ input: classes.valueInputInner }}
          error={amount.error !== null}
          onChange={evt => updateAmountHandler(evt.target.value.replace("$", ""))}
          type="numeric"
          value={amount.display === "" ? null : "$" + amount.display}
          placeholder={"$0.00"}
          // startAdornment={<Typography className={classes.startAdornment}>$</Typography>}
        />

        {amount.error && (
          <FormHelperText className={classes.helperText}>{amount.error}</FormHelperText>
        )}
      </FormControl>
      <Grid item xs={12} className={classes.xpubWrapper}>
      <FormControl xs={12} className={classes.xpubWrapper}>

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
         <FormHelperText className={recipient.error ? classes.helperText : classes.helperTextGray}>
          {recipient.error ? recipient.error : null}
          {sending && !recipient.error && "Recipient ignored for link payments"}
        </FormHelperText>
        </FormControl>
      </Grid>
      <Grid container spacing={0} direction="column">
        <Grid className={classes.buttonSpacer} />
        <Grid className={classes.buttonSpacer} />
        {sending === true && (
          <Grid container direction="row" className={classes.linkSendWrapper}>
            <Button
              className={classes.button}
              disableTouchRipple
              disabled={!!amount.error}
              color="primary"
              variant="contained"
              size="large"
              onClick={() => {
                linkHandler();
                setSending(false);
              }}
            >
              <Grid container direction="row" className={classes.linkButtonInner}>
                <Typography>Link</Typography>
                <LinkIcon className={classes.buttonIcon} />
                <Typography className={classes.linkSub}>
                  <span>{`${LINK_LIMIT.format()} Max`}</span>
                </Typography>
              </Grid>
            </Button>
            <Button
              className={classes.button}
              disableTouchRipple
              color="primary"
              size="large"
              variant="contained"
              disabled={
                !!amount.error ||
                !!recipient.error ||
                paymentState === "processingP2p" ||
                paymentState === "processingLink"
              }
              onClick={() => {
                paymentHandler();
                setSending(false);
              }}
            >
              Send
              <SendIcon className={classes.buttonIcon} />
            </Button>
          </Grid>
        )}
        {sending === false && (
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
              // component={Link}
              // to={`/send${amount.display || recipient.display ? "?" : ""}${
              //   amount.display ? `amount=${amount.display}` : ""
              // }${amount.display && recipient.display ? "&" : ""}${
              //   recipient.display ? `recipient=${recipient.display}` : ""
              // }`}
              onClick={() =>setSending(true)}
            >
              Send
              <SendIcon className={classes.buttonIcon} />
            </Button>
          </Grid>
        )}

         <Grid className={classes.buttonSpacer} />
         {sending ? (<Button
          id="goToDepositButton"
          className={classes.buttonOutlined}
          disableTouchRipple
          fullWidth
          color="primary"
          variant="outlined"
          size="large"
          onClick={()=>setSending(false)}
        >
          Cancel
        </Button>):(<Grid><Button
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
        </Grid>)}
      </Grid>
    </Grid>
  );
}

const SendCardModal = ({ amount, classes, closeModal, history, link, paymentState, recipient }) => (
  <Dialog
    open={!paymentState.matches("idle")}
    onBackdropClick={
      paymentState === "processingP2p" || paymentState === "processingLink"
        ? null
        : () => closeModal()
    }
    fullWidth
    className={classes.sendCardModalWrap}
  >
    <Grid className={classes.sendCardModalGrid} container justify="center">
      {paymentState.matches("processingP2p") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" color="primary">
              Payment In Progress
            </Typography>
          </DialogTitle>
          <DialogContent>
            <CircularProgress style={{ marginTop: "1em" }} />
          </DialogContent>
        </Grid>
      ) : paymentState.matches("processingLink") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" color="primary">
              Payment In Progress
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" className={classes.dialogText}>
              Link payment is being generated. This should take just a couple seconds.
            </DialogContentText>
            <CircularProgress style={{ marginTop: "1em" }} />
          </DialogContent>
        </Grid>
      ) : paymentState.matches("successP2p") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
              Payment Success!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" className={classes.dialogText}>
              Amount: ${formatAmountString(amount)}
            </DialogContentText>
            <DialogContentText variant="body1" className={classes.dialogText}>
              To: {recipient.substr(0, 8)}...
            </DialogContentText>
          </DialogContent>
        </Grid>
      ) : paymentState.matches("successLink") ? (
        <div style={{ width: "100%" }}>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
              Payment Link Created!
            </Typography>
          </DialogTitle>
          <DialogContent className={classes.modalContent}>
            <DialogContentText className={classes.dialogText} variant="body1" style={{}}>
              Anyone with this link can redeem the payment. Save a copy of it somewhere safe and
              only share it with the person you want to pay.
            </DialogContentText>
            <Copyable
              text={
                link ? `${link.baseUrl}?paymentId=${link.paymentId}&secret=${link.secret}` : "???"
              }
            />
          </DialogContent>
        </div>
      ) : paymentState.matches("error") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Payment Failed
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" className={classes.dialogTextRed}>
              An unknown error occured when making your payment.
            </DialogContentText>
            <DialogContentText variant="body1" className={classes.dialogTextRed}>
              Please try again in 30s and contact support if you continue to experience issues.
              (Settings --> Support)
            </DialogContentText>
          </DialogContent>
        </Grid>
      ) : (
        <div />
      )}

      {paymentState === "processingP2p" || paymentState === "processingLink" ? (
        <div />
      ) : (
        <DialogActions>
          <Button
            disableTouchRipple
            color="primary"
            variant="outlined"
            size="medium"
            onClick={() => closeModal()}
          >
            Close
          </Button>
          <Button
            disableTouchRipple
            style={{
              background: "#FFF",
              border: "1px solid #F22424",
              color: "#F22424",
              marginLeft: "5%",
            }}
            variant="outlined"
            size="medium"
            onClick={() => history.push("/")}
          >
            Home
          </Button>
        </DialogActions>
      )}
    </Grid>
  </Dialog>
);

Home.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Home);
