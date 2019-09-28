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
import { Zero } from "ethers/constants";
import { isHexString, formatEther } from "ethers/utils";
import React, { useCallback, useEffect, useState } from "react";
import queryString from "query-string";

import { Currency } from "../utils";
import { MySnackbar } from "../components/snackBar";

const RedeemPaymentStates = {
  IsSender: 0,
  Redeeming: 1,
  PaymentAlreadyRedeemed: 2,
  Collateralizing: 3,
  Timeout: 4,
  SecretError: 5,
  OtherError: 6,
  Success: 7,
}

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px"
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
    marginBottom: "2em",
    marginTop: "2em",
  },
}));

export const RedeemCard = style(props => {
  const [secret, setSecret] = useState(undefined);
  const [paymentId, setPaymentId] = useState(undefined);
  const [assetId, setAssetId] = useState(undefined);
  const [amount, setAmount] = useState(undefined);
  const [redeemPaymentState, setRedeemPaymentState] = useState(RedeemPaymentStates.Redeeming);
  const [showReceipt, setShowReceipt] = useState(false);

  const { channel, classes, history, location, swapRate, token, tokenProfile } = props;

  // Wrapping this in useCallback so that useEffect knows when to re-render
  // https://reactjs.org/docs/hooks-faq.html#is-it-safe-to-omit-functions-from-the-list-of-dependencies
  const redeemPayment = useCallback(async () => {
    console.log(`Attempting to redeem payment.`)
    if (!channel || !tokenProfile) { return; }
    // only proceed if status is redeeming
    if (redeemPaymentState !== RedeemPaymentStates.Redeeming) {
      console.log("Incorrect payment state, expected Redeeming, got", Object.keys(RedeemPaymentStates)[redeemPaymentState]);
      return;
    }
    if (!secret) {
      console.log("No secret detected, cannot redeem payment.");
      setRedeemPaymentState(RedeemPaymentStates.SecretError);
      return;
    }
    try {
      // if the token profile cannot handle the amount
      // update the profile, the hub will collateralize the
      // correct amount anyway from the listeners
      // Request token collateral if we don't have any yet
      let freeTokenBalance = await channel.getFreeBalance(token.address);
      let hubFreeBalanceAddress = Object.keys(freeTokenBalance).filter(
        addr => addr.toLowerCase() !== channel.freeBalanceAddress.toLowerCase(),
      )[0]
      if (freeTokenBalance[hubFreeBalanceAddress].eq(Zero)) {
        console.log(`Requesting collateral for token ${token.address}`)
        await channel.requestCollateral(token.address);
      }
      freeTokenBalance = await channel.getFreeBalance(token.address);
      console.log(`Hub has collateralized us with ${formatEther(freeTokenBalance[hubFreeBalanceAddress])} tokens`)
      const result = await channel.resolveCondition({
        conditionType: "LINKED_TRANSFER",
        paymentId,
        preImage: secret,
      });
      console.log(`Redeemed payment with result: ${JSON.stringify(result, null, 2)}`)
      // make sure hub isnt silently failing by returning null purchase id
      // as it processes collateral
      if (!result.paymentId) {
        // allows for retry logic
        console.log(`Bad redemption, retrying..`)
        setRedeemPaymentState(RedeemPaymentStates.Redeeming);
        return;
      }
      setShowReceipt(false);
      setRedeemPaymentState(RedeemPaymentStates.Success);
    } catch (e) {
      console.error(`Error redeeming: ${e.message}`)
      // known potential failure: already redeemed or channel not available
      if (e.message.indexOf("already been redeemed") !== -1) {
        setRedeemPaymentState(RedeemPaymentStates.PaymentAlreadyRedeemed);
        return;
      }
      if (!(await channel.getChannel()).available) {
        console.warn(`Channel not available yet.`);
        return;
      }
      setRedeemPaymentState(RedeemPaymentStates.OtherError);
      setShowReceipt(false);
    }
  }, [channel, paymentId, redeemPaymentState, secret, token, tokenProfile])

  const closeModal = () => {
    setShowReceipt(false);
  }

  const validateUrl = () => {
    // called by the sender of the redeemed payment as
    // they click to copy. should display a warning text
    // if the secret or if the amount token is not valid
    // or does not correspond to the generated URL
    let errs = []
    // state not yet set
    if (!secret || !amount) {
      return errs
    }
    // valid secret?
    if (!isHexString(secret)) {
      errs.push("Secret is invalid")
    }
    // valid amount?
    let value
    try {
      value = Currency.DAI(amount, swapRate)
    } catch {
      console.log("Invalid amount:", amount)
      errs.push("Invalid amount")
      return errs
    }
    if (value.wad.lte(Zero)) {
      errs.push("Token balance should be greater than zero")
    }
    // print amount for easy confirmation
    // TODO: display more helpful messages here
    errs.push(`Amount: ${amount}`)
    errs.push(`Secret: ${secret.substr(0, 10)}...`)
    return errs
  }

  useEffect(() => {
    (async () => {
      console.log(`useEffect location activated!`)
      const query = queryString.parse(location.search);
      console.log(`Redeem card launched with url query: ${JSON.stringify(query)}`)
      setSecret(query.secret);
      setPaymentId(query.paymentId);
      if (!channel || !query.paymentId) { return; }
      const link = await channel.getLinkedTransfer(query.paymentId);
      console.log(`Got linked transfer ${query.paymentId}: ${JSON.stringify(link)}`);
      setAssetId(link.assetId);
      setAmount(Currency.DEI(link.amount));
    })()
  }, [channel, location]);

  /*
  useEffect(() => {
    console.log(`Other useEffect activated!`)
    // set state vars if they exist
    if (location.state && location.state.isConfirm) {
      // TODO: test what happens if not routed with isConfirm
      setRedeemPaymentState(RedeemPaymentStates.IsSender);
      setShowReceipt(false);
      return;
    }
    // set status to redeeming on mount if not sender
    setRedeemPaymentState(RedeemPaymentStates.Redeeming);
    let stopExternal = false
    const interval = setInterval(
      async (iteration, stop) => {
        const processing = redeemPaymentState === RedeemPaymentStates.Redeeming || redeemPaymentState === RedeemPaymentStates.Collateralizing
        if (stopExternal || (redeemPaymentState && !processing)) {
          stop()
        }
        await redeemPayment()
        setRedeemPaymentState(redeemPaymentState)
      },
      3000,
    )
    // Return the cleanup function which halts the interval
    return () => { clearInterval(interval) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  */

  return (
    <Grid>
    <Grid
      container
      spacing={1}
      direction="column"
      style={{
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        textAlign: "center",
        justifyContent: "center",
      }}
    >

    <Grid container>
      <Grid item xs={12}>
        <RedeemConfirmationDialog
          open={showReceipt}
          amount={amount}
          redeemPaymentState={redeemPaymentState}
          history={history}
          closeModal={closeModal}
          swapRate={swapRate}
        />
      </Grid>

      <Grid item xs={12}>
        <ReceiveIcon className={classes.icon} />
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="h5">
          <span>{getTitle(redeemPaymentState, amount)}</span>
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="h5" visible={assetId}>
          Payment:
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="body1" visible={assetId}>
           Amount: {amount ? amount.toDAI().format() : "N/A"}
        </Typography>
      </Grid>

      <Typography noWrap variant="body1" visible={assetId}>
         Asset: {assetId || "N/A"}
      </Typography>

      {/*
      <Grid item xs={12} style={{marginTop: "5%"}}>
        <RedeemCardContent
          url={generateQrUrl(secret, paymentId, assetId, amount)}
          onCopy={handleCopy}
          classes={classes}
          validateUrl={validateUrl}
          redeemPaymentState={redeemPaymentState}
        />
      </Grid>
      */}

      <Grid item xs={12}>
        <Button
          className={classes.button}
          disabled={false}
          fullWidth
          onClick={redeemPayment}
          size="large"
          variant="contained"
        >
          Redeem
        </Button>
      </Grid>

      <Grid item xs={12}>
        <Button
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            marginTop: "5%"
          }}
          size="medium"
          onClick={() => props.history.push("/")}
        >
          Back
        </Button>
      </Grid>
     </Grid>
     </Grid>
     </Grid>
  )
})

const getTitle = (redeemPaymentState, amount) => {
  let title
  switch (redeemPaymentState) {
    case RedeemPaymentStates.IsSender:
      title = "Scan to Redeem"
      break
    case RedeemPaymentStates.PaymentAlreadyRedeemed:
    case RedeemPaymentStates.Timeout:
    case RedeemPaymentStates.SecretError:
    case RedeemPaymentStates.OtherError:
      title = "Uh Oh! Payment Failed"
      break
    case RedeemPaymentStates.Success:
      title = `Payment of ${amount.format()} Redeemed!`
      break
    case RedeemPaymentStates.Redeeming:
    case RedeemPaymentStates.Collateralizing:
    default:
      title = "What's up?"
      break
  }
  return title
}

const RedeemConfirmationDialog = (props) => (
  <Dialog
    open={props.open}
    onBackdropClick={() =>
      props.redeemPaymentState === RedeemPaymentStates.Collateralizing
        ? null
        : props.closeModal()
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
      spacing={1}
      direction="column"
      style={{
        textAlign: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
      }}
      justify="center"
    >
      {RedeemPaymentDialogContent(props.redeemPaymentState, props.amount, props.swapRate)}
      {props.redeemPaymentState === RedeemPaymentStates.Collateralizing ? (
        <></>
      ) : (
        <DialogActions 
          style={{
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          <Button
            style={{
              border: "1px solid #F22424",
              color: "#F22424",
              marginBottom: "1.5em"
            }}
            variant="outlined"
            size="medium"
            onClick={() => props.history.push("/")}
          >
            Home
          </Button>
        </DialogActions>
      )}
    </Grid>
  </Dialog>
);

const RedeemCardContent = (props) => {
  const {redeemPaymentState, url, classes, validateUrl, onCopy} = props
  if (!classes) {
    return
  }
  let senderInfo, icon, warnings
  switch(redeemPaymentState) {
    case RedeemPaymentStates.PaymentAlreadyRedeemed:
      icon = (<ErrorIcon className={classes.icon} />)
      warnings = ["Payment has already been redeemed."]
      break
    case RedeemPaymentStates.Timeout:
      icon = (<ErrorIcon className={classes.icon} />)
      warnings = ["Payment timed out"]
      break
    case RedeemPaymentStates.SecretError:
      icon = (<ErrorIcon className={classes.icon} />)
      warnings = ["Are you sure your secret is right?"]
      break
    case RedeemPaymentStates.OtherError:
      icon = (<ErrorIcon className={classes.icon} />)
      warnings = ["Something went wrong"]
      break
    case RedeemPaymentStates.Collateralizing:
      icon = (<CircularProgress className={classes.icon} />)
      warnings = ["Setting up your card too. This will take 30-40s."]
      break
    case RedeemPaymentStates.Success:
      icon = (<DoneIcon className={classes.icon} />)
      break
    case RedeemPaymentStates.Redeeming:
    default:
      icon = (<CircularProgress className={classes.icon} />)
      break
  }
  const finalWarnings = warnings ? warnings.map((w, index) => {
    return (
      <Typography key={index} variant="body1" style={{margin: "0.1em"}}>
        <span>{w}</span>
      </Typography>
    )
  }) : warnings
  return (
    <div>
    <Grid container>
      <Grid item xs={12}>{senderInfo}</Grid>
      <Grid item xs={12} color="primary" style={{
          paddingTop: "5%",
        }}>{icon}</Grid>
      <Grid item xs={12}>
        {finalWarnings}
      </Grid>
    </Grid>
    </div>
  )
}

const RedeemPaymentDialogContent = (redeemPaymentState, amount, swapRate) => {
  switch (redeemPaymentState) {
    case RedeemPaymentStates.Timeout:
      return (
      <Grid>
        <DialogTitle disableTypography>
          <Typography variant="h5" style={{ color: "#F22424" }}>
            Payment Failed
          </Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
            This is most likely because your Card is being set up.
          </DialogContentText>
          <DialogContentText variant="body1" style={{ color: "#0F1012", paddingTop: "5%" }}>
            Please try again in 30s and contact support if you
            continue to experience issues. (Settings --> Support)
          </DialogContentText>
          </DialogContent>
      </Grid>
      )
    case RedeemPaymentStates.PaymentAlreadyRedeemed:
      return (
        <Grid>
            <DialogTitle disableTypography>
              <Typography variant="h5" style={{ color: "#F22424" }}>
                Payment Failed
              </Typography>
            </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              It appears this payment has already been redeemed.
            </DialogContentText>
          </DialogContent>
        </Grid>
      )
    case RedeemPaymentStates.Success:
      return (
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
          </DialogContent>
        </Grid>
      )
    default:
      return
  }
}
