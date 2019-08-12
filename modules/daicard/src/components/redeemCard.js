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
import React, { Component } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import queryString from "query-string";

import { Currency } from "../utils";
import MySnackbar from "../components/snackBar";

import { QRGenerate } from "./qrCode";

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
});

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

class RedeemCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      secret: null,
      paymentId: null,
      assetId: null,
      amoutn: null,
      redeemPaymentState: RedeemPaymentStates.Redeeming,
      showReceipt: false,
      copied: false,
    };
  }

  async componentDidMount() {
    const { location } = this.props;
    const query = queryString.parse(location.search);
    console.log(`Redeem card launched with url query: ${JSON.stringify(query)}`)
    // uncondonditionally set secret from query
    this.setState({
      secret: query.secret,
      paymentId: query.paymentId,
      assetId: query.assetId,
      amount: query.amount,
    });
    // set state vars if they exist
    if (location.state && location.state.isConfirm) {
      // TODO: test what happens if not routed with isConfirm
      this.setState({ 
        redeemPaymentState: RedeemPaymentStates.IsSender,
        showReceipt: false,
      });
      return;
    }
    // set status to redeeming on mount if not sender
    this.setState({ redeemPaymentState: RedeemPaymentStates.Redeeming });
    let { redeemPaymentState } = this.state
    await interval(
      async (iteration, stop) => {
        const processing = redeemPaymentState === RedeemPaymentStates.Redeeming || redeemPaymentState === RedeemPaymentStates.Collateralizing
        if (redeemPaymentState && !processing) {
          stop()
        }
        await this.redeemPayment()
        redeemPaymentState = this.state.redeemPaymentState
      },
      1000,
    )
  }

  async redeemPayment() {
    const { secret, paymentId, amount, assetId, redeemPaymentState } = this.state;
    const { channel, token } = this.props;
    if (!channel) { return; }
    // only proceed if status is redeeming
    if (redeemPaymentState !== RedeemPaymentStates.Redeeming) {
      console.log("Incorrect payment state, expected Redeeming, got", Object.keys(RedeemPaymentStates)[redeemPaymentState]);
      return;
    }
    if (!secret) {
      console.log("No secret detected, cannot redeem payment.");
      this.setState({ 
        redeemPaymentState: RedeemPaymentStates.SecretError,
      })
      return;
    }
    try {

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
        amount: parseEther(amount).toString(),
        assetId, // TODO: sanity check this
        conditionType: "LINKED_TRANSFER",
        paymentId,
        preImage: secret,
      });
      console.log(`Redeemed payment with result: ${JSON.stringify(result, null, 2)}`)
      // make sure hub isnt silently failing by returning null purchase id
      // as it processes collateral
      if (!result.purchaseId || !result.amount) {
        // allows for retry logic
        console.log(`Bad redemption, retrying..`)
        this.setState({ redeemPaymentState: RedeemPaymentStates.Redeeming })
        return;
      }
      this.setState({
        showReceipt: false,
        redeemPaymentState: RedeemPaymentStates.Success
      });
    } catch (e) {
      console.error(`Error redeeming: ${e.message}`)
      // known potential failure: already redeemed or channel not available
      if (e.message.indexOf("Payment has been redeemed") !== -1) {
        this.setState({ 
          // red: true, 
          redeemPaymentState: RedeemPaymentStates.PaymentAlreadyRedeemed,
        });
        return;
      }
      if (!(await channel.getChannel()).available) {
        console.warn(`Channel not available yet.`);
        return;
      }
      this.setState({ 
        redeemPaymentState: RedeemPaymentStates.OtherError,
        showReceipt: false,
      })
    }
  }

  generateQrUrl(secret, paymentId, assetId, amount) {
    return `${window.location.origin}/redeem?secret=${secret}&paymentId=${paymentId}&` +
      `assetId=${assetId}&amount=${amount}`
  }

  closeModal() {
    this.setState({ showReceipt: false })
  }

  closeSnackBar() {
    this.setState({ copied: false })
  }

  handleCopy() {
    this.setState({ copied: true })
  }

  validateUrl() {
    // called by the sender of the redeemed payment as
    // they click to copy. should display a warning text
    // if the secret or if the amount token is not valid
    // or does not correspond to the generated URL
    const { secret, amount, copied } = this.state
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
      value = Currency.DAI(amount)
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

  render() {
    const { classes, history } = this.props;
    const { secret, paymentId, assetId, amount, showReceipt, redeemPaymentState, copied } = this.state;
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
        onClose={this.closeSnackBar.bind(this)}
        message="Copied!"
      />

      <Grid container>
        <Grid item xs={12}>
          <RedeemConfirmationDialog
            open={showReceipt}
            amount={amount}
            redeemPaymentState={redeemPaymentState}
            history={history}
            closeModal={this.closeModal.bind(this)}
          />
        </Grid>

        <Grid item xs={12}>
          <ReceiveIcon className={classes.icon} />
        </Grid>

        <Grid item xs={12}>
          <Typography noWrap variant="h5">
            <span>{getTitle(redeemPaymentState)}</span>
          </Typography>
        </Grid>

        <Grid item xs={12} style={{marginTop: "5%"}}>
          <RedeemCardContent
            url={this.generateQrUrl(secret, paymentId, assetId, amount)}
            onCopy={this.handleCopy.bind(this)}
            classes={classes}
            validateUrl={this.validateUrl.bind(this)}
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
            onClick={() => this.props.history.push("/")}
          >
            Back
          </Button>
        </Grid>
       </Grid>
       </Grid>
       </Grid>
    );
  }
}

const getTitle = (redeemPaymentState) => {
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
      title = "Payment Redeemed!"
      break
    case RedeemPaymentStates.Redeeming:
    case RedeemPaymentStates.Collateralizing:
    default:
      title = "Redeeming Payment..."
      break
  }
  return title
}

const RedeemConfirmationDialog = props => (
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
      {RedeemPaymentDialogContent(props.redeemPaymentState, props.amount)}
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

const RedeemPaymentDialogContent = (redeemPaymentState, amount) => {
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
              Amount: {Currency.DAI(amount).toETH().format()}
            </DialogContentText>
          </DialogContent>
        </Grid>
      )
    default:
      return
  }
}

export default withStyles(styles)(RedeemCard);
