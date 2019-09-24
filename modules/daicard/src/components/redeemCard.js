import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import {
  Done as DoneIcon,
  ErrorOutline as ErrorIcon,
  SaveAlt as ReceiveIcon,
} from "@material-ui/icons";
import { Zero } from "ethers/constants";
import { isHexString, parseEther, formatEther } from "ethers/utils";
import interval from "interval-promise";
import React, { useEffect, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import queryString from "query-string";

import { Currency } from "../utils";
import { MySnackbar } from "../components/snackBar";

import { QRGenerate } from "./qrCode";

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
  }
}));

export const RedeemCard = style(props => {
  const [secret, setSecret] = useState(undefined);
  const [paymentId, setPaymentId] = useState(undefined);
  const [assetId, setAssetId] = useState(undefined);
  const [amount, setAmount] = useState(undefined);
  const [redeemPaymentState, setRedeemPaymentState] = useState(RedeemPaymentStates.Redeeming);
  const [showReceipt, setShowReceipt] = useState(false);
  const [copied, setCopied] = useState(false);

  const { channel, classes, history, location, swapRate, token, tokenProfile } = props;

  useEffect(() => {
    (async () => {
      const query = queryString.parse(location.search);
      console.log(`Redeem card launched with url query: ${JSON.stringify(query)}`)
      setSecret(query.setSecret);
      setPaymentId(query.paymentId);
      setAssetId(query.assetId);
      setAmount(query.amount);
      // set state vars if they exist
      if (location.state && location.state.isConfirm) {
        // TODO: test what happens if not routed with isConfirm
        setRedeemPaymentState(RedeemPaymentStates.IsSender);
        setShowReceipt(false);
        return;
      }
      // set status to redeeming on mount if not sender
      setRedeemPaymentState(RedeemPaymentStates.Redeeming);
      await interval(
        async (iteration, stop) => {
          const processing = redeemPaymentState === RedeemPaymentStates.Redeeming || redeemPaymentState === RedeemPaymentStates.Collateralizing
          if (redeemPaymentState && !processing) {
            stop()
          }
          await redeemPayment()
          setRedeemPaymentState(redeemPaymentState)
        },
        1000,
      )
    })()
  }, []);

  const redeemPayment = async () => {
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

      if (assetId.toLowerCase() !== token.address.toLowerCase()) {
        console.error("Received link with incorrect token address");
        return;
      }

      const result = await channel.resolveCondition({
        amount: parseEther(amount).toString(),
        assetId,
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
  }

  const generateQrUrl = (secret, paymentId, assetId, amount) => {
    return `${window.location.origin}/redeem?secret=${secret}&paymentId=${paymentId}&` +
      `assetId=${assetId}&amount=${amount}`
  }

  const closeModal = () => {
    setShowReceipt(false);
  }

  const closeSnackBar = () => {
    setCopied(false);
  }

  const handleCopy = () => {
    setCopied(true);
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
      errs.push("Secret copied is invalid")
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
      errs.push("Copied token balance should be greater than zero")
    }
    // print amount for easy confirmation
    // TODO: display more helpful messages here
    if (copied) {
      errs.push(`Amount: ${amount}`)
      errs.push(`Secret: ${secret.substr(0, 10)}...`)
    }
    return errs
  }

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
    <MySnackbar
      variant="success"
      openWhen={copied}
      onClose={closeSnackBar}
      message="Copied!"
    />

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

      <Grid item xs={12} style={{marginTop: "5%"}}>
        <RedeemCardContent
          url={generateQrUrl(secret, paymentId, assetId, amount)}
          onCopy={handleCopy}
          classes={classes}
          validateUrl={validateUrl}
          redeemPaymentState={redeemPaymentState}
        />
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
      title = `Payment of $${amount} Redeemed!`
      break
    case RedeemPaymentStates.Redeeming:
    case RedeemPaymentStates.Collateralizing:
    default:
      title = "Redeeming Payment..."
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
    case RedeemPaymentStates.IsSender:
      senderInfo = (
        <Grid container>
          <Grid item xs={12} style={{paddingBottom: "5%"}}>
            <QRGenerate value={url} />
          </Grid>
          <Grid item xs={12}>
            <CopyToClipboard text={url} onCopy={onCopy}>
              <Button variant="outlined" fullWidth>
                <Typography noWrap variant="body1">
                  <Tooltip
                    disableFocusListener
                    disableTouchListener
                    title="Click to Copy"
                  >
                    <span>{url}</span>
                  </Tooltip>
                </Typography>
              </Button>
            </CopyToClipboard>
          </Grid>
        </Grid>
      )
      warnings = ["Make sure to copy this link!"].concat(validateUrl())
      break
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
              Amount: {Currency.DAI(amount, swapRate).toETH().format()}
            </DialogContentText>
          </DialogContent>
        </Grid>
      )
    default:
      return
  }
}
