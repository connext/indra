import { withStyles, Button, CircularProgress, Dialog, DialogTitle, DialogContentText, DialogContent, DialogActions } from "@material-ui/core";
import ReceiveIcon from "@material-ui/icons/SaveAlt";
import DoneIcon from "@material-ui/icons/Done";
import ErrorIcon from "@material-ui/icons/ErrorOutline";
import React, { Component } from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import QRGenerate from "./qrGenerate";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Web3 from "web3";
import { getAmountInDAI } from "../utils/currencyFormatting";
import interval from "interval-promise";
import MySnackbar from "../components/snackBar";
import { ethers as eth } from "ethers";

const Big = (n) => eth.utils.bigNumberify(n.toString())
const queryString = require("query-string");

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

function getTitle (redeemPaymentState) {
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
      spacing={16}
      direction="column"
      style={{
        textAlign: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
      }}
      justify="center"
    >
      {RedeemPaymentDialogContent(
        props.redeemPaymentState,
        props.amount,
        props.connextState,
      )}
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
      const urlErrs = validateUrl()
      warnings = ["Make sure to copy this link!"].concat(urlErrs)
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
      <Typography key={index} variant="body1" style={{margin: "1em"}}>
        <span>{w}</span>
      </Typography>
    )
  }) : warnings

  return (
    <div>
    <Grid container>
      <Grid item xs={12}>{senderInfo}</Grid>
      <Grid item xs={12} color="primary" style={{
          paddingTop: "10%",
        }}>{icon}</Grid>
      <Grid item xs={12}>
        {finalWarnings}
      </Grid>
    </Grid>
    </div>
  )
}

function RedeemPaymentDialogContent(redeemPaymentState, amount, connextState) {
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
              Amount: {getAmountInDAI(amount, connextState)}
            </DialogContentText>
          </DialogContent>
        </Grid>
      )
    default:
      return
  }
}

class RedeemCard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      secret: null,
      redeemPaymentState: RedeemPaymentStates.Redeeming,
      purchaseId: null,
      showReceipt: false,
      amount: null,
      copied: false,
    };
  }

  async componentWillMount() {
    const { location } = this.props;
    const query = queryString.parse(location.search);
    // uncondonditionally set secret from query
    this.setState({
      secret: query.secret,
      amount: {
        amountToken: Web3.utils.toWei(query.amountToken, "ether"),
        amountWei: "0" // TODO: add wei
      }
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

    this.redeemPoller()
  }

  async redeemPoller() {
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

  generateQrUrl(secret, amount) {
    const { publicUrl } = this.props;
    // TODO: add wei
    const url = `${publicUrl}/redeem?secret=${
      secret ? secret : ""
    }&amountToken=${amount ? Web3.utils.fromWei(amount.amountToken, "ether") : "0"}`;
    return url;
  }

  async collateralizeChannel() {
    const {
      amount,
      redeemPaymentState,
    } = this.state;
    const { connext, channelState, connextState } = this.props;
    if (!connext || !channelState || !connextState) {
      return;
    }

    // only proceed if status is collateralizing
    if (redeemPaymentState !== RedeemPaymentStates.Collateralizing) {
      console.log("Incorrect payment state, expected Collateralizing, got", RedeemPaymentStates[redeemPaymentState]);
      this.setState({ redeemPaymentState: RedeemPaymentStates.OtherError })
      return;
    }

    let hasCollateral = false
    await interval(
      async (iteration, stop) => {
        // check if the channel has sufficient collateral
        // if you are awaiting a collateral request, return
        if (connextState.runtime.awaitingOnchainTransaction) {
          return
        }
        // eval channel collateral
        hasCollateral = Big(channelState.balanceTokenHub).gte(
          Big(amount.amountToken)
        )

        if (hasCollateral || iteration > 30) {
          stop();
        }
      },
      5000,
      { iterations: 30 }
    );

    // still needs collateral to facilitate payment, exit
    if (!hasCollateral) {
      this.setState({
        showReceipt: true,
        redeemPaymentStates: RedeemPaymentStates.Timeout,
      });
    }

    this.setState({
      showReceipt: true,
      redeemPaymentStates: RedeemPaymentStates.Redeeming,
    });
  }

  async redeemPayment() {
    const {
      secret,
      purchaseId,
      amount,
      redeemPaymentState,
    } = this.state;
    const { connext, channelState, connextState } = this.props;
    if (!connext || !channelState || !connextState) {
      return;
    }

    // only proceed if status is redeeming
    if (redeemPaymentState !== RedeemPaymentStates.Redeeming) {
      console.log("Incorrect payment state, expected Redeeming, got", Object.keys(RedeemPaymentStates)[redeemPaymentState]);
      this.setState({ 
        showReceipt: true,
      })
      return;
    }

    if (!secret) {
      console.log("No secret detected, cannot redeem payment.");
      this.setState({ 
        redeemPaymentState: RedeemPaymentStates.SecretError,
        showReceipt: true,
      })
      return;
    }

    // user is not payor, channel has collateral, can try to redeem payment
    try {
      if (!purchaseId) {
        const updated = await connext.redeem(secret);
        // make sure hub isnt silently failing by returning null purchase id
        // as it processes collateral
        if (!updated.purchaseId || !updated.amount) {
          // allows for retry logic
          this.setState({ redeemPaymentState: RedeemPaymentStates.Redeeming })
          return;
        }

        this.setState({
          purchaseId: updated.purchaseId,
          amount: updated.amount,
          showReceipt: true,
          redeemPaymentState: RedeemPaymentStates.Success
        });
      }
    } catch (e) {
      // known potential failures: not collateralized, or
      // already redeemed
      if (e.message.indexOf("Payment has been redeemed") !== -1) {
        this.setState({ 
          // red: true, 
          redeemPaymentState: RedeemPaymentStates.PaymentAlreadyRedeemed,
          showReceipt: true,
        });
        return;
      }

      // check if the channel has collateral, otherwise display loading
      if (
        Big(channelState.balanceTokenHub).lt(
          Big(amount.amountToken))
        ) {
        // channel does not have collateral
        this.setState({ redeemPaymentState: RedeemPaymentStates.Collateralizing })
        await this.collateralizeChannel();
        return;
      }

      this.setState({ 
        redeemPaymentState: RedeemPaymentStates.OtherError,
        showReceipt: true,
      })
    }
  }

  closeModal = () => {
    this.setState({ showReceipt: false })
  }

  closeSnackBar = () => {
    this.setState({ copied: false })
  }

  validateUrl = () => {
    // called by the sender of the redeemed payment as
    // they click to copy. should display a warning text
    // if the secret or if the amount token is not valid
    // or does not correspond to the generated URL
    const { secret, amount, copied } = this.state
    const { connextState } = this.props
    let errs = []
    // state not yet set
    if (!connextState || !secret || !amount) {
      return errs
    }
    // valid secret
    if (!Web3.utils.isHex(secret)) {
      errs.push("Secret copied is invalid")
    }
    // valid amount
    if (!amount.amountToken || amount.amountWei !== "0") {
      console.log("Invalid amount:", amount)
      errs.push("Invalid amount")
      return errs
    }
    const token = Big(amount.amountToken)
    if (token.lt(eth.constants.Zero)) {
      errs.push("Copied token balance is negative")
    }
    // print amount for easy confirmation
    // TODO: display more helpful messages here
    if (copied) {
      errs.push(`Amount: ${getAmountInDAI(amount, connextState)}`)
      errs.push(`Secret: ${secret.substr(0, 10)}...`)
    }
    
    return errs
  }

  handleCopy = () => {
    this.setState({ copied: true })
  }

  render() {
    const {
      secret,
      showReceipt,
      amount,
      redeemPaymentState,
      copied,
    } = this.state;

    const { classes, connextState, history } = this.props;
    const url = this.generateQrUrl(secret, amount);

    return (
      <Grid>
      <Grid
        container
        spacing={16}
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
        onClose={this.closeSnackBar}
        message="Copied!"
      />
      <Grid container>
        <Grid item xs={12}>
          <RedeemConfirmationDialog
            open={showReceipt}
            amount={amount}
            redeemPaymentState={redeemPaymentState}
            history={history}
            connextState={connextState}
            closeModal={this.closeModal}
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

        <Grid item xs={12} style={{marginTop: "10%"}}>
          <RedeemCardContent
            url={url}
            onCopy={this.handleCopy}
            classes={classes}
            validateUrl={this.validateUrl}
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
              marginTop: "10%"
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

export default withStyles(styles)(RedeemCard);
