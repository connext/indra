import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Typography,
  withStyles,
} from "@material-ui/core";
import {
  Done as DoneIcon,
  ErrorOutline as ErrorIcon,
  SaveAlt as ReceiveIcon,
} from "@material-ui/icons";
import PropTypes from "prop-types";

import { useMachine } from "@xstate/react";
import { AddressZero } from "ethers/constants";
import { formatEther } from "ethers/utils";
import React, { useCallback, useEffect, useState } from "react";
import queryString from "query-string";

import { redeemMachine } from "../state";
import { Currency } from "../utils";

const styles = {
  top: {
    paddingLeft: "10%",
    paddingRight: "10%",
    paddingTop: "10%",
    textAlign: "center",
    justifyContent: "center",
  },
  icon: {
    width: "40px",
    height: "40px",
  },
  backButton: {
    background: "#FFF",
    border: "1px solid #F22424",
    color: "#F22424",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
    marginBottom: "2em",
    marginTop: "2em",
  },
  homeButton: {
    border: "1px solid #F22424",
    color: "#F22424",
    marginBottom: "1.5em",
  },
  modalDialog: {
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    margin: "0",
  },
  modalGrid: {
    textAlign: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    margin: "0",
    width: "100%",
  },
  modalAction: {
    border: "1px solid #F22424",
    color: "#F22424",
    marginBottom: "1.5em",
  },
  typographyFullWidth:{
    width: "100%"
  },
  amountContainer:{
    marginBottom: "3%", marginTop: "3%" 
  },
  dialogContent:{
    color: "#0F1012", paddingTop: "5%" 
  },
  dialogActionWrapper:{
    textAlign: "center", justifyContent: "center"
  }
};

const RedeemCard = props => {
  const { channel, classes, history, location, tokenProfile } = props;
  const [paymentId, setPaymentId] = useState("");
  const [secret, setSecret] = useState("");
  const [link, setLink] = useState({
    amount: Currency.DAI("0"),
    assetId: AddressZero,
    status: "UNKNOWN",
  });
  const [message, setMessage] = useState("");
  const [state, takeAction] = useMachine(redeemMachine);

  const validateLink = useCallback(async () => {
    takeAction(`CHECK`);
    setMessage(`Verifying info...`);
    if (!channel || !tokenProfile) {
      setMessage(`Channel isn't ready yet..`);
      return;
    }
    if (!paymentId || typeof paymentId !== "string") {
      takeAction(`INVALIDATE`);
      setMessage(`Missing a valid paymentId`);
      return;
    }
    const info = await channel.getLinkedTransfer(paymentId);
    console.log(`Got linked transfer ${paymentId}: ${JSON.stringify(info, null, 2)}`);
    if (!info) {
      takeAction(`INVALIDATE`);
      setMessage(`Unknown Payment Id`);
      return;
    }
    if (info.status !== "PENDING") {
      takeAction("INVALIDATE");
      setMessage(`Payment has already been redeemed...`);
      return;
    }
    if (info.assetId !== tokenProfile.assetId) {
      takeAction(`INVALIDATE`);
      setMessage(`Only link payments for DAI are supported`);
      return;
    }
    if (!secret) {
      takeAction(`INVALIDATE`);
      setMessage(`No secret detected, cannot redeem payment.`);
      return;
    }
    takeAction(`VALIDATE`);
    setMessage(`Redeem whenever you're ready`);
    setLink({
      amount: Currency.DEI(info.amount).toDAI(),
      status: info.status,
      assetId: info.assetId,
    });
  }, [channel, paymentId, secret, takeAction, tokenProfile]);

  useEffect(() => {
    (async () => {
      const query = queryString.parse(location.search);
      setPaymentId(query.paymentId);
      setSecret(query.secret);
      await validateLink();
    })();
  }, [location, validateLink]);

  const redeemPayment = async () => {
    if (!state.matches("modal.confirm")) {
      return;
    }
    console.log(`Attempting to redeem payment.`);
    let hubFreeBalanceAddress;
    try {
      // if the token profile cannot handle the amount
      // update the profile, the hub will collateralize the
      // correct amount anyway from the listeners
      // Request token collateral if we don't have any yet
      let freeTokenBalance = await channel.getFreeBalance(tokenProfile.assetId);
      hubFreeBalanceAddress = Object.keys(freeTokenBalance).find(
        addr => addr.toLowerCase() !== channel.freeBalanceAddress.toLowerCase(),
      );
      // TODO: compare to default collateralization?
      if (freeTokenBalance[hubFreeBalanceAddress].lt(link.amount.wad)) {
        takeAction(`COLLATERALIZE`);
        setMessage(`Requesting ${link.amount.format()} of collateral`);
        const collateralNeeded = link.amount.wad.sub(freeTokenBalance[hubFreeBalanceAddress]);
        await channel.addPaymentProfile({
          amountToCollateralize: collateralNeeded.toString(),
          minimumMaintainedCollateral: link.amount.wad.toString(),
          assetId: tokenProfile.assetId,
        });
        await channel.requestCollateral(tokenProfile.assetId);
      }
    } catch (e) {
      takeAction("ERROR");
      setMessage(`Error collateralizing: ${e.message}`);
    }

    try {
      const freeTokenBalance = await channel.getFreeBalance(tokenProfile.assetId);
      console.log(
        `Hub has collateralized us with ${formatEther(
          freeTokenBalance[hubFreeBalanceAddress],
        )} tokens`,
      );
      takeAction(`REDEEM`);
      setMessage(`This should take just a few seconds`);
      const result = await channel.resolveCondition({
        conditionType: "LINKED_TRANSFER",
        paymentId,
        preImage: secret,
      });
      console.log(`Redeemed payment with result: ${JSON.stringify(result, null, 2)}`);
      // make sure hub isnt silently failing by returning null purchase id
      // as it processes collateral
      if (!result.paymentId) {
        // allows for retry logic
        takeAction(`ERROR`);
        setMessage(`Payment redemption failed, try again soon`);
        return;
      }
      takeAction("SUCCESS");
      setMessage(`Redeemed payment of ${link.amount.format()}`);
    } catch (e) {
      // known potential failure: already redeemed or channel not available
      if (e.message.indexOf("already been redeemed") !== -1) {
        takeAction("INVALIDATE");
        setMessage("Payment has already been redeemed");
        return;
      }
      takeAction("ERROR");
      setMessage(`Error redeeming`);
      console.error(e);
    }
  };

  let icon, title;
  if (state.matches("idle")) {
    icon = <ReceiveIcon className={classes.icon} />;
    title = "Input paymentId & secret to redeem";
  } else if (state.matches("checking")) {
    icon = <CircularProgress className={classes.icon} />;
    title = "Verifying Payment";
  } else if (state.matches("invalid")) {
    icon = <ErrorIcon className={classes.icon} />;
    title = "Invalid";
  } else if (state.matches("error")) {
    icon = <ErrorIcon className={classes.icon} />;
    title = "Error";
  } else if (state.matches("ready")) {
    icon = <DoneIcon className={classes.icon} />;
    title = "Ready";
  } else if (state.matches("collateralizing")) {
    icon = <CircularProgress className={classes.icon} />;
    title = "Collateralizing";
  } else if (state.matches("redeeming")) {
    icon = <CircularProgress className={classes.icon} />;
    title = "Redeeming link";
  } else if (state.matches("success")) {
    icon = <DoneIcon className={classes.icon} />;
    title = "Success";
  }

  return (
    <Grid container spacing={1} direction="column" className={classes.top}>
      <Grid item xs={12}>
        {icon}
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="h5">
          <span>{title}</span>
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography variant="body1" style={{ margin: "0.1em" }}>
          <span>{message}</span>
        </Typography>
      </Grid>

      <Grid container className={classes.amountContainer}>
        <Grid item xs={5}>
          <Typography noWrap variant="body1">
            Amount: {link.amount.format() || "$0.00"}
          </Typography>
        </Grid>
        <Grid item xs={7}>
          <Typography variant="body1">Status: {link.status}</Typography>
        </Grid>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="body1" className={classes.typographyFullWidth}>
          PaymentId: {paymentId}
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="body1" className={classes.typographyFullWidth}>
          Secret: {secret}
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          className={classes.button}
          disabled={!state.matches("ready")}
          fullWidth
          onClick={() => takeAction("CONFIRM")}
          size="large"
          variant="contained"
        >
          Redeem
        </Button>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          className={classes.backButton}
          size="medium"
          onClick={() => history.push("/")}
        >
          Back
        </Button>
      </Grid>

      <RedeemCardModal
        amount={link.amount}
        history={history}
        message={message}
        redeemPayment={redeemPayment}
        state={state}
        takeAction={takeAction}
        classes={classes}
      />
    </Grid>
  );
};

const RedeemCardModal = ({
  amount,
  history,
  message,
  redeemPayment,
  state,
  takeAction,
  classes,
}) => (
  <Dialog
    open={state.matches("modal")}
    onBackdropClick={() =>
      state.matches("confirm")
        ? takeAction("GO_BACK")
        : state.matches("collateralizing") || state.matches("redeeming")
        ? undefined
        : takeAction("DISMISS")
    }
    fullWidth
    className={classes.modalDialog}
  >
    <Grid container spacing={1} direction="column" className={classes.modalGrid} justify="center">
      {state.matches("modal.confirm") ? (
        <div>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Are you sure you want to redeem?
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" className={classes.dialogContent}>
              The payment will be saved to this browser's local storage.
            </DialogContentText>
            <DialogContentText variant="body1" className={classes.dialogContent}>
              WARNING: If you redeem in an incognito window and you have not backed up your seed
              phrase, you will lose this money.
            </DialogContentText>
            Get a copy of your seed phrase anytime by visiting settings.
            <DialogContentText
              variant="body1"
              className={classes.dialogContent}
            ></DialogContentText>
            <DialogActions className={classes.dialogActionWrapper}>
              <Button
                disableTouchRipple
                className={classes.modalAction}
                variant="outlined"
                size="medium"
                onClick={() => {
                  console.log(`Confirmed: redeeming payment`);
                  redeemPayment();
                }}
              >
                Confirm
              </Button>
              <Button
                disableTouchRipple
                className={classes.modalAction}
                variant="outlined"
                size="medium"
                onClick={() => takeAction("GO_BACK")}
              >
                Go Back
              </Button>
            </DialogActions>
          </DialogContent>
        </div>
      ) : state.matches("modal.collateralizing") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Requesting Collateral...
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>
      ) : state.matches("modal.redeeming") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" color="primary">
              Redeeming Payment...
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>
      ) : state.matches("modal.error") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Failed to redeem payment
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>
      ) : state.matches("modal.success") ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
              Redeemed Successfully!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              Amount: {amount.format()}
            </DialogContentText>
            <DialogActions className={classes.dialogActionWrapper}>
              <Button
                disableTouchRipple
                className={classes.homeButton}
                variant="outlined"
                size="medium"
                onClick={() => history.push("/")}
              >
                Home
              </Button>
            </DialogActions>
          </DialogContent>
        </Grid>
      ) : (
        <div />
      )}
    </Grid>
  </Dialog>
);

RedeemCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(RedeemCard);
