import { ConditionalTransferTypes } from "@connext/types";
import { Currency, toBN, getRandomBytes32 } from "@connext/utils";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Send as SendIcon, Link as LinkIcon } from "@material-ui/icons";
import { useMachine } from "@xstate/react";
import { constants } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import queryString from "query-string";

import { sendMachine } from "../state";

import { Copyable } from "./copyable";
import { usePublicIdentifier, PublicIdentifierInput } from "./input";

const { Zero } = constants;

const LINK_LIMIT = Currency.DAI("10"); // $10 capped linked payments

const style = withStyles((theme) => ({
  modalContent: {
    margin: "0% 4% 4% 4%",
    padding: "0px",
    width: "92%",
  },
  icon: {
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
  },
}));

const formatAmountString = (amount) => {
  const [whole, part] = amount.split(".");
  return `${whole || "0"}.${part ? part.padEnd(2, "0") : "00"}`;
};

export const SendCard = style(
  ({ balance, channel, classes, ethProvider, history, location, token }) => {
    const [amount, setAmount] = useState({ display: "", error: null, value: null });
    const [link, setLink] = useState(undefined);
    const [paymentState, paymentAction] = useMachine(sendMachine);
    const [recipient, setRecipient, setRecipientError] = usePublicIdentifier(null, ethProvider);

    // need to extract token balance so it can be used as a dependency for the hook properly
    const tokenBalance = balance.channel.token.wad;
    const updateAmountHandler = useCallback(
      (rawValue) => {
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

    const paymentHandler = async () => {
      if (!channel || !token || amount.error || recipient.error) return;
      if (!recipient.value) {
        setRecipientError("Recipent must be specified for p2p transfer");
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
            conditionType: ConditionalTransferTypes.LinkedTransfer,
            paymentId: getRandomBytes32(),
            preImage: getRandomBytes32(),
            recipient: recipient.value,
            meta: { source: "daicard" },
          });
          break;
        } catch (e) {
          await new Promise((res) => setTimeout(res, 5000));
        }
      }
      if (!transferRes) {
        paymentAction("ERROR");
        return;
      }
      paymentAction("DONE");
    };

    const linkHandler = async () => {
      if (!channel || !token || amount.error) return;
      if (recipient.error && !recipient.value) {
        setRecipientError(null);
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
          conditionType: ConditionalTransferTypes.LinkedTransfer,
          paymentId: getRandomBytes32(),
          preImage: getRandomBytes32(),
          meta: { source: "daicard" },
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

    const closeModal = () => {
      paymentAction("DISMISS");
    };

    useEffect(() => {
      const query = queryString.parse(location.search);
      if (!amount.value && query.amount) {
        updateAmountHandler(query.amount);
      }
      if (!recipient.value && !recipient.error && query.recipient) {
        setRecipient(query.recipient);
      }
    }, [
      location,
      updateAmountHandler,
      setRecipient,
      amount.value,
      recipient.value,
      recipient.error,
    ]);

    return (
      <Grid
        container
        spacing={2}
        direction="column"
        style={{
          display: "flex",
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justify: "center",
        }}
      >
        <Grid container wrap="nowrap" direction="row" justify="center" alignItems="center">
          <Grid item xs={12}>
            <SendIcon className={classes.icon} />
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h2">
              <span>
                {balance.channel.token.toDAI().format({ decimals: 2, symbol: false, round: false })}
              </span>
            </Typography>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="body2">
            <span>{`Linked payments are capped at ${LINK_LIMIT.format()}.`}</span>
          </Typography>
        </Grid>

        <Grid item xs={12} style={{ width: "100%" }}>
          <TextField
            fullWidth
            error={amount.error !== null}
            helperText={amount.error}
            id="outlined-number"
            label="Amount"
            margin="normal"
            onChange={(evt) => updateAmountHandler(evt.target.value)}
            style={{ width: "100%" }}
            type="number"
            value={amount.display}
            variant="outlined"
          />
        </Grid>

        <Grid item xs={12} style={{ width: "100%" }}>
          <PublicIdentifierInput address={recipient} setAddress={setRecipient} />
        </Grid>

        <Grid item xs={12}>
          <Grid container direction="row" alignItems="center" justify="center" spacing={8}>
            <Grid item xs={6}>
              <Button
                disableTouchRipple
                className={classes.button}
                disabled={!!amount.error}
                fullWidth
                onClick={() => {
                  linkHandler();
                }}
                size="large"
                variant="contained"
              >
                Link
                <LinkIcon style={{ marginLeft: "5px" }} />
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                disableTouchRipple
                className={classes.button}
                disabled={
                  !!amount.error ||
                  !!recipient.error ||
                  paymentState === "processingP2p" ||
                  paymentState === "processingLink"
                }
                fullWidth
                onClick={() => {
                  paymentHandler();
                }}
                size="large"
                variant="contained"
              >
                Send
                <SendIcon style={{ marginLeft: "5px" }} />
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
        </Grid>

        <SendCardModal
          amount={amount.display ? amount.display : "0"}
          classes={classes}
          closeModal={closeModal}
          history={history}
          link={link}
          paymentState={paymentState}
          recipient={recipient.value}
        />
      </Grid>
    );
  },
);

const SendCardModal = ({ amount, classes, closeModal, history, link, paymentState, recipient }) => (
  <Dialog
    open={!paymentState.matches("idle")}
    onBackdropClick={
      paymentState === "processingP2p" || paymentState === "processingLink"
        ? null
        : () => closeModal()
    }
    fullWidth
    style={{
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
    }}
  >
    <Grid
      container
      style={{
        backgroundColor: "#FFF",
        paddingTop: "10%",
        paddingBottom: "10%",
      }}
      justify="center"
    >
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
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
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
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              Amount: ${formatAmountString(amount)}
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
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
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
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
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              An unknown error occured when making your payment.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
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
