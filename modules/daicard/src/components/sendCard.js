import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputBase,
  Grid,
  Typography,
  withStyles,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { Send as SendIcon, Link as LinkIcon } from "@material-ui/icons";
import { useMachine } from "@xstate/react";
import { Zero } from "ethers/constants";
import React, { useCallback, useEffect, useState } from "react";
import queryString from "query-string";

import { Currency, toBN } from "../utils";
import { sendMachine } from "../state";

import Copyable from "./copyable";
import { AmountInput, useAmount, useXpub, XpubInput } from "./input"

const LINK_LIMIT = Currency.DAI("10"); // $10 capped linked payments

const styles = {
  modalContent: {
    margin: "0% 4% 4% 4%",
    padding: "0px",
    width: "92%",
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
  icon: {
    color: "#fca311",
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },

  top: {
    display: "flex",
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justify: "center",
  },
  valueInput: {
    color: "#FCA311",
    fontSize: "60px",
    cursor: "none",
    overflow: "hidden",
    width: "100%",
  },
  valueInputInner: {
    textAlign: "center",
    margin: "auto",
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
  QRbutton: {
    color: "#fca311",
  },
  linkSendWrapper: {
    justifyContent: "space-between",
  },
  buttonSpacer: {
    height: "10px",
    width: "100%",
  },
  button: {
    color: "#FFF",
    width: "48%",
  },
  buttonIcon: {
    marginLeft: "5px",
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
  dialogText:{
    color: "#FCA311", margin: "1em"
  },
  dialogTextRed:{
    color: "#F22424", margin: "1em"
  }
};

const formatAmountString = amount => {
  const [whole, part] = amount.split(".");
  return `${whole || "0"}.${part ? part.padEnd(2, "0") : "00"}`;
};

const SendCard = props => {
  const { balance, classes, createLinkPayment, ethProvider, history, location, sendPayment } = props;
  const [amount, setAmount] = useAmount(null, balance.channel.token, Currency.DEI("1")); 
  const [link, setLink] = useState(undefined);
  const [paymentState, paymentAction] = useMachine(sendMachine);
  const [recipient, setRecipient, setRecipientError] = useXpub(null, ethProvider);

  useEffect(() => {
    const query = queryString.parse(location.search);
    if (!amount.value && query.amount) {
      setAmount(query.amount);
    }
    if (!recipient.value && !recipient.error && query.recipient) {
      setRecipient(query.recipient);
    }
    // Only need to run this on first render to deal w query string values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Grid className={classes.top} container spacing={2} direction="column">
      <Grid item xs={12} style={{ width: "100%" }}>
        <AmountInput amount={amount} setAmount={setAmount} messages={{
          greater: "Please enter a value less than your balance",
          less: "Please enter a value greater than 0",
          invalid: "Please enter a valid number",
        }}/>
      </Grid>
      <Grid item xs={12} style={{ width: "100%" }}>
        <XpubInput xpub={recipient} setXpub={setRecipient} />
      </Grid>
      <Grid className={classes.buttonSpacer} />
      <Grid className={classes.buttonSpacer} />
      <Grid container direction="row" className={classes.linkSendWrapper}>
        <Button
          className={classes.button}
          disableTouchRipple
          disabled={
            !!amount.error ||
            !amount.value || amount.value.wad.eq(Zero) ||
            !!recipient.error ||
            paymentState === "processingP2p" ||
            paymentState === "processingLink"
          }
          color="primary"
          variant="contained"
          size="large"
          onClick={async () => {
            if (recipient.error && !recipient.value) {
              setRecipientError(null);
            }
            if (toBN(amount.value.toDEI()).gt(LINK_LIMIT.wad)) {
              setAmount({
                ...amount,
                error: `Linked payments are capped at ${LINK_LIMIT.format()}.`,
              });
              return;
            }
            setLink(await createLinkPayment(amount, recipient, paymentAction));
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
            !amount.value || amount.value.wad.eq(Zero) ||
            !!recipient.error ||
            paymentState === "processingP2p" ||
            paymentState === "processingLink"
          }
          onClick={() => {
            if (!recipient.value) {
              setRecipientError("Recipent must be specified for p2p transfer");
              return;
            }
            sendPayment(amount, recipient, paymentAction);
          }}
        >
          Send
          <SendIcon className={classes.buttonIcon} />
        </Button>
      </Grid>

      <Dialog
        open={!paymentState.matches("idle")}
        onBackdropClick={
          paymentState === "processingP2p" || paymentState === "processingLink"
            ? null
            : () => paymentAction("DISMISS")
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
                  Amount: ${formatAmountString(amount.display ? amount.display : "0")}
                </DialogContentText>
                <DialogContentText variant="body1" className={classes.dialogText}>
                  To: {recipient.value.substr(0, 8)}...
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
                <DialogContentText className={classes.dialogText} variant="body1" style={{ }}>
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
                onClick={() => paymentAction("DISMISS")}
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

    </Grid>
  );
};

SendCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SendCard);
