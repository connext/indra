import * as Connext from 'connext';
import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import SendIcon from "@material-ui/icons/Send";
import TextField from "@material-ui/core/TextField";
import QRIcon from "mdi-material-ui/QrcodeScan";
import LinkIcon from "@material-ui/icons/Link";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Modal from "@material-ui/core/Modal";
import * as eth from 'ethers';
import QRScan from "./qrScan";
import {
  withStyles,
  Grid,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@material-ui/core";
import interval from "interval-promise";
import Web3 from "web3";
import { getOwedBalanceInDAI } from "../utils/currencyFormatting";

const Big = (n) => eth.utils.bigNumberify(n.toString())
const convertPayment = Connext.convert.Payment
const convertChannelState = Connext.convert.ChannelState
const emptyAddress = eth.constants.AddressZero
const queryString = require("query-string");
// $10 capped linked payments
const LINK_LIMIT = eth.utils.parseEther("10")
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  },
  input: {
    width: "100%"
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF"
  }
});

const PaymentStates = {
  None: 0,
  Collateralizing: 1,
  CollateralTimeout: 2,
  OtherError: 3,
  Success: 4
};

// possible returns of requesting collateral
// payment succeeded
// monitoring requests timed out, still no collateral
// appropriately collateralized
const CollateralStates = {
  PaymentMade: 0,
  Timeout: 1,
  Success: 2
};

function ConfirmationDialogText(paymentState, amountToken, recipient) {
  switch (paymentState) {
    case PaymentStates.Collateralizing:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" color="primary">
              Payment In Progress
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              Recipient's Card is being set up. This should take 20-30 seconds.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              If you stay on this page, your payment will be retried automatically. 
              If you navigate away or refresh the page, you will have to attempt the payment again yourself.
            </DialogContentText>
          <CircularProgress style={{ marginTop: "1em" }} />
          </DialogContent>
        </Grid>
      );
    case PaymentStates.CollateralTimeout:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
            Payment Failed
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
            After some time, recipient channel could not be initialized.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
            Is the receiver online to set up their Card? Please try your payment again later. If
              you have any questions, please contact support. (Settings -->
              Support)
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.OtherError:
      return (
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
            Please try again in 30s and contact support if you continue to
              experience issues. (Settings --> Support)
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.Success:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
            Payment Success!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
            Amount: ${amountToken}
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
            To: {recipient.substr(0, 5)}...
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.None:
    default:
      return <div />;
  }
}

const PaymentConfirmationDialog = props => (
  <Dialog
    open={props.showReceipt}
    onBackdropClick={
      props.paymentState === PaymentStates.Collateralizing
        ? null
        : () => props.closeModal()
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
        paddingBottom: "10%"
      }}
      justify="center"
    >
      {ConfirmationDialogText(
        props.paymentState,
        props.amountToken,
        props.recipient
      )}
      {props.paymentState === PaymentStates.Collateralizing ? (
        <></>
      ) : (
        <DialogActions>
          <Button
            color="primary"
            variant="outlined"
            size="medium"
            onClick={() => props.closeModal()}
          >
            Pay Again
          </Button>
          <Button
            style={{
              background: "#FFF",
              border: "1px solid #F22424",
              color: "#F22424",
              marginLeft: "5%"
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

class PayCard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      paymentVal: {
        meta: {
          purchaseId: "payment"
          // memo: "",
        },
        payments: [
          {
            recipient: props.scanArgs.recipient
              ? props.scanArgs.recipient
              : "",
            amountToken: props.scanArgs.amount
              ? Web3.utils.toWei(props.scanArgs.amount)
              : "0",
            amountWei: "0",
          }
        ]
      },
      addressError: null,
      balanceError: null,
      paymentState: PaymentStates.None,
      scan: false,
      displayVal: props.scanArgs.amount ? props.scanArgs.amount : "0",
      showReceipt: false,
      multipleLinks: false, // TODO: remove
      count: null,
    };
  }

  async componentDidMount() {
    const { location } = this.props;
    const query = queryString.parse(location.search);
    if (query.amountToken) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amountToken = Web3.utils.toWei(
          query.amountToken
        );
        oldState.displayVal = query.amountToken;
        return oldState;
      });
    }
    if (query.recipient) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].recipient = query.recipient;
        return oldState;
      });
    }
  }

  async updatePaymentHandler(value) {
    // if there are more than 18 digits after the decimal, do not
    // count them.
    // throw a warning in the address error
    let balanceError = null
    const decimal = (
      value.startsWith('.') ? value.substr(1) : value.split('.')[1]
    )

    let tokenVal = value
    if (decimal && decimal.length > 18) {
      tokenVal = value.startsWith('.') ? value.substr(0, 19) : value.split('.')[0] + '.' + decimal.substr(0, 18)
      balanceError = `Value too precise! Using ${tokenVal}`
    }
    await this.setState(oldState => {
      oldState.paymentVal.payments[0].amountToken = value
        ? Web3.utils.toWei(`${tokenVal}`, "ether")
        : "0";
      if (balanceError) {
        oldState.balanceError = balanceError;
      }
      return oldState;
    });

    this.setState({ displayVal: value, });
  }

  // TODO: remove
  updateCount = (count) => {
    this.setState({ count })
  }

  handleQRData = async scanResult => {
    const { publicUrl } = this.props;

    let data = scanResult.split("/send?");
    if (data[0] === publicUrl) {
      let temp = data[1].split("&");
      let amount = temp[0].split("=")[1];
      let recipient = temp[1].split("=")[1];
      this.updatePaymentHandler(amount);
      this.updateRecipientHandler(recipient);
    } else {
      this.updateRecipientHandler(scanResult);
      console.log("incorrect site");
    }
    this.setState({
      scan: false
    });
  };

  async updateRecipientHandler(value) {
    this.setState(async oldState => {
      oldState.paymentVal.payments[0].recipient = value;

      return oldState;
    });
  }

  // validates recipient and payment amount
  // also sets the variables of these values in the state
  // returns the values it sets, to prevent async weirdness
  validatePaymentInput(paymentVal) {
    const address = paymentVal.payments[0].recipient;
    const payment = convertPayment("bn", paymentVal.payments[0]);
    const { channelState } = this.props;
    this.setState({ addressError: null, balanceError: null });

    let balanceError = null
    let addressError = null
    // validate that the token amount is within bounds
    if (payment.amountToken.gt(Big(channelState.balanceTokenUser))) {
      balanceError = "Insufficient balance in channel";
    }
    if (payment.amountToken.lte(Big(0)) ) {
      balanceError = "Please enter a payment amount above 0";
    }

    // validate recipient is valid address OR the empty address
    // recipient address can be empty
    const isLink = paymentVal.payments[0].type === "PT_LINK";
    const isValidRecipient = Web3.utils.isAddress(address) &&
      (isLink ? address === emptyAddress : address !== emptyAddress);

    if (!isValidRecipient) {
      addressError = address + " is an invalid address";
    }

    // linked payments also have a maximum enforced
    if (isLink && payment.amountToken.gt(LINK_LIMIT)) {
      // balance error here takes lower precendence than preceding
      // balance errors, only reset if undefined
      balanceError = balanceError || "Linked payments are capped at $10.";
    }
    this.setState({ balanceError, addressError });

    return { balanceError, addressError };
  }

  async linkHandler() {
    const { connext } = this.props;
    const { paymentVal } = this.state;

    // TODO: remove!
    const address = paymentVal.payments[0].recipient;
    if (address && ADMIN_SECRET && address === ADMIN_SECRET) {
      this.setState({ multipleLinks: true })
      return
    } else {
      this.setState({ multipleLinks: false })
    }

    // generate secret, set type, and set
    // recipient to empty address
    const payment = {
      ...paymentVal.payments[0],
      type: "PT_LINK",
      recipient: emptyAddress,
      meta: {
        secret: connext.generateSecret()
      }
    };

    const updatedPaymentVal = {
      ...paymentVal,
      payments: [payment]
    };

    // unconditionally set state
    this.setState({
      paymentVal: updatedPaymentVal
    });

    // check for validity of input fields
    const { balanceError, addressError } = this.validatePaymentInput(
      updatedPaymentVal
    );

    if (addressError || balanceError) {
      return;
    }

    // send payment
    await this._sendPayment(updatedPaymentVal);
  }

  async paymentHandler() {
    const { connext } = this.props;
    const { paymentVal } = this.state;
    // check if the recipient needs collateral
    const needsCollateral = await connext.recipientNeedsCollateral(
      paymentVal.payments[0].recipient,
      convertPayment("str", { amountWei: paymentVal.payments[0].amountWei, amountToken: paymentVal.payments[0].amountToken })
    );
    // do not send collateral request if it is not valid
    // check if the values are reasonable
    // before beginning the request for collateral
    const { balanceError, addressError } = this.validatePaymentInput(
      paymentVal
    );
    if (addressError || balanceError) {
      return;
    }

    // needs collateral can indicate that the recipient does
    // not have a channel, or that it does not have current funds
    // in either case, you need to send a failed payment
    // to begin auto collateralization process
    if (needsCollateral) {
      // this can have 3 potential outcomes:
      // - collateralization failed (return)
      // - payment succeeded (return)
      // - channel collateralized
      const collateralizationStatus = await this.collateralizeRecipient(
        paymentVal
      );
      switch (collateralizationStatus) {
        // setting state for these cases done in collateralize
        case CollateralStates.PaymentMade:
        case CollateralStates.Timeout:
          return;
        case CollateralStates.Success:
        default:
        // send payment via fall through
      }
    }

    // send payment
    await this._sendPayment(paymentVal);
  }

  async collateralizeRecipient(paymentVal) {
    const { connext } = this.props;
    // do not collateralize on pt link payments
    if (paymentVal.payments[0].type === "PT_LINK") {
      return;
    }

    // collateralize otherwise
    this.setState({
      paymentState: PaymentStates.Collateralizing,
      showReceipt: true
    });

    // collateralize by sending payment
    const err = await this._sendPayment(paymentVal, true);
    // somehow it worked???
    if (!err) {
      this.setState({
        showReceipt: true,
        paymentState: PaymentStates.Success
      });
      return CollateralStates.PaymentMade;
    }

    // call to send payment failed, monitor collateral
    // watch for confirmation on the recipients side
    // of the channel for 20s
    let needsCollateral
    await interval(
      async (iteration, stop) => {
        // returns null if no collateral needed
        needsCollateral = await connext.recipientNeedsCollateral(
          paymentVal.payments[0].recipient,
          convertPayment("str", paymentVal.payments[0].amount)
        );
        if (!needsCollateral || iteration > 20) {
          stop();
        }
      },
      5000,
      { iterations: 20 }
    );

    if (needsCollateral) {
      this.setState({
        showReceipt: true,
        paymentState: PaymentStates.CollateralTimeout
      });
      return CollateralStates.Timeout;
    }

    return CollateralStates.Success;
  }

  // TODO: remove from admin modal
  // TODO: logging... lol
  async generateMultipleLinks() {
    const { channelState, connext } = this.props;
    const { paymentVal, count } = this.state;
    if (!paymentVal || !count) {
      console.warn("Error finding count or paymentVal in state:", this.state)
      return
    }

    if (!channelState || !connext) {
      console.warn("Error finding channelState or connext in props:", this.props)
      return
    }
    const channel = convertChannelState("bn", channelState)

    // get only the amount from the payment
    const amountToken = Big(paymentVal.payments[0].amountToken)
    // if balance < count * amountToken, err
    console.log('******* count', count)
    console.log('******* amountToken', amountToken.toString())
    console.log('******* balanceTokenUser', channel.balanceTokenUser.toString())
    console.log('******* mul', Big(count).mul(amountToken).toString())
    if (Big(count).mul(amountToken).gt(channel.balanceTokenUser)) {
      console.error("Insufficient funds for count * amountToken purchase value")
      return
    }
    // generate payments in loop for buy
    // all payments will have unique secrets, but the same
    // denominated value
    let payments = []
    let i = 0
    while (i < count) {
      payments.push({
        recipient: emptyAddress,
        amountToken: amountToken.toString(),
        amountWei: "0",
        type: "PT_LINK",
        meta: { secret: connext.generateSecret() }
      })
      i++
    }
    const purchase = {
      meta: { reason: `Multiple link generation by ${channelState.user}`},
      payments,
    }

    // try to purchase
    try {
      const { purchaseId } = await connext.buy(purchase)
      console.log('************************************')
      console.log(`Successful creation of multiple linked payments! Prepare for logging......`)
      console.log(`********* purchaseId: ${purchaseId}`)
      console.log(`********* link overview:`)
      console.log(`amountToken in wei on link:`, amountToken.toString())
      console.log(`total links in purchase:`, purchase.payments.length)
      console.log('************************************')
      console.log('************************************')
      console.log('Here are your secrets:')
      console.log(payments.map(p => p.meta.secret).toString())
      console.log('************************************')
      console.log('************************************')
      console.log('Here is the submitted purchase:')
      console.log(JSON.stringify(purchase, null, 2))
    } catch (e) {
      console.error("Not successful at making linked payments, please try again, or bug Layne on discord :)")
      return
    }
  }

  // returns a string if there was an error, null
  // if successful
  async _sendPayment(paymentVal, isCollateralizing = false) {
    const { connext } = this.props;

    const { balanceError, addressError } = this.validatePaymentInput(
      paymentVal
    );
    // return if either errors exist
    // state is set by validator
    // mostly a sanity check, this should be done before calling
    // this function
    if (balanceError || addressError) {
      return;
    }

    // collateralizing is handled before calling this send payment fn
    // by either payment or link handler
    // you can call the appropriate type here
    try {
      await connext.buy(paymentVal);
      if (paymentVal.payments[0].type === "PT_LINK") {
        // automatically route to redeem card
        const secret = paymentVal.payments[0].meta.secret;
        const amountToken = paymentVal.payments[0].amountToken;
        this.props.history.push({
          pathname: "/redeem",
          // TODO: add wei
          search: `?secret=${secret}&amountToken=${
            Web3.utils.fromWei(amountToken, "ether")
          }`,
          state: { isConfirm: true, secret, amountToken }
        });
      } else {
        // display receipts
        this.setState({
          showReceipt: true,
          paymentState: PaymentStates.Success
        });
      }
      return null;
    } catch (e) {
      if (!isCollateralizing) {
        // only assume errors if collateralizing
        console.log("Unexpected error sending payment:", e);
        this.setState({
          paymentState: PaymentStates.OtherError,
          showReceipt: true
        });
      }
      // setting state for collateralize handled in 'collateralizeRecipient'
      return e.message;
    }
  }

  closeModal = () => {
    this.setState({ showReceipt: false, paymentState: PaymentStates.None });
  };

  render() {
    const { classes, connextState } = this.props;
    const { paymentState, paymentVal, displayVal, balanceError, addressError, scan, showReceipt, sendError } = this.state;
    return (
      <Grid
        container
        spacing={16}
        direction="column"
        style={{
          display: "flex",
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justify: "center"
        }}
      >
        <Grid
          container
          wrap="nowrap"
          direction="row"
          justify="center"
          alignItems="center"
        >
          <Grid item xs={12}>
            <SendIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h2">
              <span>
                {getOwedBalanceInDAI(connextState)}
              </span>
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2">
            <span>{"Linked payments are capped at $10."}</span>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="outlined-number"
            label="Amount"
            value={displayVal}
            type="number"
            margin="normal"
            variant="outlined"
            onChange={evt => this.updatePaymentHandler(evt.target.value)}
            error={balanceError !== null}
            helperText={balanceError}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            style={{ width: "100%" }}
            id="outlined"
            label="Recipient Address"
            type="string"
            value={
              paymentVal.payments[0].recipient === emptyAddress
                ? ""
                : paymentVal.payments[0].recipient
            }
            onChange={evt => this.updateRecipientHandler(evt.target.value)}
            margin="normal"
            variant="outlined"
            helperText={
              addressError
                ? addressError
                : "Optional for linked payments"
            }
            error={addressError !== null}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip
                    disableFocusListener
                    disableTouchListener
                    title="Scan with QR code"
                  >
                    <Button
                      variant="contained"
                      color="primary"
                      style={{ color: "#FFF" }}
                      onClick={() => this.setState({ scan: true })}
                    >
                      <QRIcon />
                    </Button>
                  </Tooltip>
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Modal
          id="qrscan"
          open={scan}
          onClose={() => this.setState({ scan: false })}
          style={{
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            position: "absolute",
            top: "10%",
            width: "375px",
            marginLeft: "auto",
            marginRight: "auto",
            left: "0",
            right: "0"
          }}
        >
          <QRScan
            handleResult={this.handleQRData}
            history={this.props.history}
          />
        </Modal>
        {/* TODO: remove modal */}
        <Dialog
          id="multipleLinks"
          open={this.state.multipleLinks}
          onClose={() => this.setState({ multipleLinks: false })}
        >
          <DialogContent>
            <TextField
              id="outlined-number"
              label="Number of Links"
              value={this.state.count || 0}
              type="number"
              margin="normal"
              variant="outlined"
              onChange={evt => this.updateCount(evt.target.value)}
            />
            <TextField
              id="outlined-number"
              label="Amount Dai in Link"
              value={displayVal}
              type="number"
              margin="normal"
              variant="outlined"
              onChange={evt => this.updatePaymentHandler(evt.target.value)}
            />
            <DialogActions>
              <Button
                className={classes.button}
                variant="contained"
                onClick={() => this.generateMultipleLinks()}
              >
                Send
                <SendIcon style={{ marginLeft: "5px" }} />
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
        <Grid item xs={12}>
          <Grid
            container
            direction="row"
            alignItems="center"
            justify="center"
            spacing={16}
          >
            <Grid item xs={6}>
              <Button
                fullWidth
                className={classes.button}
                variant="contained"
                size="large"
                onClick={() => {this.linkHandler()}}
              >
                Link
                <LinkIcon style={{ marginLeft: "5px" }} />
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                className={classes.button}
                variant="contained"
                size="large"
                onClick={() => {this.paymentHandler()}}
              >
                Send
                <SendIcon style={{ marginLeft: "5px" }} />
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="outlined"
            style={{
              background: "#FFF",
              border: "1px solid #F22424",
              color: "#F22424",
              width: "15%"
            }}
            size="medium"
            onClick={() => this.props.history.push("/")}
          >
            Back
          </Button>
        </Grid>
        <PaymentConfirmationDialog
          showReceipt={showReceipt}
          sendError={sendError}
          amountToken={
            paymentVal.payments[0].amountToken
              ? Web3.utils.fromWei(
                  paymentVal.payments[0].amountToken
                )
              : "0"
          }
          recipient={paymentVal.payments[0].recipient}
          history={this.props.history}
          closeModal={this.closeModal}
          paymentState={paymentState}
        />
      </Grid>
    );
  }
}

export default withStyles(styles)(PayCard);
