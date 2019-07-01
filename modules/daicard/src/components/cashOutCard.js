import * as Connext from "connext";
import { ethers as eth } from "ethers";
import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import TextField from "@material-ui/core/TextField";
import QRIcon from "mdi-material-ui/QrcodeScan";
import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import Tooltip from "@material-ui/core/Tooltip";
import InputAdornment from "@material-ui/core/InputAdornment";
import Modal from "@material-ui/core/Modal";
import QRScan from "./qrScan";
import { withStyles, Grid, Typography, CircularProgress } from "@material-ui/core";
import { getOwedBalanceInDAI } from "../utils/currencyFormatting";
import interval from "interval-promise";
import { hasPendingTransaction } from '../utils/hasOnchainTransaction'

const { hasPendingOps } = new Connext.Utils();
const Big = (n) => eth.utils.bigNumberify(n.toString())

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF"
  },
  modal: {
    position: "absolute",
    top: "-400px",
    left: "150px",
    width: theme.spacing.unit * 50,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing.unit * 4,
    outline: "none"
  }
});

class CashOutCard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      withdrawalVal: {
        // withdrawalWeiUser: "0",
        // tokensToSell: "0",
        // withdrawalTokenUser: "0",
        // weiToSell: "0",
        recipient: "0x0..."
      },
      addressError: null,
      balanceError: null,
      scan: false,
      withdrawEth: true,
      aggregateBalance: "0.00",
      withdrawing: false
    };
  }

  async updateWithdrawalVals(withdrawEth) {
    this.setState({ withdrawEth });

    // set the state to contain the proper withdrawal args for
    // eth or dai withdrawal
    const { channelState, connextState, exchangeRate } = this.props
    let { withdrawalVal } = this.state;

    if (withdrawEth && channelState && connextState) {
      const { custodialBalance } = connextState.persistent
      const amountToken = Big(channelState.balanceTokenUser).add(custodialBalance.balanceToken)
      const amountWei = Big(channelState.balanceWeiUser).add(custodialBalance.balanceWei)
      // withdraw all channel balance in eth
      withdrawalVal = {
        ...withdrawalVal,
        exchangeRate,
        tokensToSell: amountToken.toString(),
        withdrawalWeiUser: amountWei.toString(),
        weiToSell: "0",
        withdrawalTokenUser: "0"
      };
    } else {
      console.error("Not permitting withdrawal of tokens at this time")
      return
    }

    this.setState({ withdrawalVal });
    return withdrawalVal;
  }

  // examines if the display value should be updated
  // when the component is mounting, or when the props change

  // NOTE: the amount to cashout != channel card amount if there is 
  // wei in the channel
  async updateDisplayValue() {
    const { channelState, connextState } = this.props;
    if (!channelState) {
      this.setState({ aggregateBalance: "$0.00" });
      return;
    }

    this.setState({
      aggregateBalance: getOwedBalanceInDAI(connextState, false)
    });
  }

  // update display value with the exchange rate/
  // channel balance changes
  async componentWillReceiveProps() {
    await this.updateDisplayValue();
  }

  async componentDidMount() {
    await this.updateDisplayValue();
  }

  async updateRecipientHandler(value) {
    if (value.includes("ethereum:")) {
      let temp = value.split(":")
      value = temp[1]
    }
    this.setState({
      recipientDisplayVal: value,
      scan: false
    });
    await this.setState(oldState => {
      oldState.withdrawalVal.recipient = value;
      return oldState;
    });
  }

  poller = async () => {
    await interval(
      async (iteration, stop) => {
        const { runtime } = this.props
        if (!hasPendingTransaction(runtime)) {
          stop()
        }
      },
      1000,
    )
    this.setState({ withdrawing: false })
    this.props.history.push("/")
  };

  async withdrawalHandler(withdrawEth) {
    const { connext } = this.props;
    const withdrawalVal = await this.updateWithdrawalVals(withdrawEth);
    const recipient = withdrawalVal.recipient.toLowerCase()
    this.setState({ addressError: null });
    // check for valid address
    if (recipient === "0x0...") {
      this.setState({ addressError: "Please provide an address" });
      return;
    }
    if (!eth.utils.isHexString(recipient)) {
      this.setState({ addressError: `Invalid hex string: ${recipient}` });
      return;
    }
    if (eth.utils.arrayify(recipient).length !== 20) {
      this.setState({ addressError: `Invalid length: ${recipient}` });
      return;
    }
    // check the input balance is under channel balance
    // invoke withdraw modal
    this.setState({ withdrawing: true });

    console.log(`Withdrawing: ${JSON.stringify(withdrawalVal, null, 2)}`);
    await connext.withdraw(withdrawalVal);

    this.poller();
  }

  render() {
    const { classes, exchangeRate, connextState, channelState } = this.props;
    const {
      recipientDisplayVal,
      addressError,
      scan,
      aggregateBalance /*, withdrawing*/
    } = this.state;
    return (
      <Grid
        container
        spacing={16}
        direction="column"
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justifyContent: "center"
        }}
      >
        {/* <ProgressModalWrapped withdrawing={withdrawing} /> */}
        <Grid
          container
          wrap="nowrap"
          direction="row"
          justify="center"
          alignItems="center"
        >
          <Grid item xs={12}>
            <UnarchiveIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h2">
              <span>{aggregateBalance}</span>
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption">
            <span>{"ETH price: $" + exchangeRate}</span>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            style={{ width: "100%" }}
            id="outlined-with-placeholder"
            label="Address"
            placeholder="0x0..."
            value={recipientDisplayVal || ""}
            onChange={evt => this.updateRecipientHandler(evt.target.value)}
            margin="normal"
            variant="outlined"
            required
            helperText={addressError}
            error={addressError != null}
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
                      style={{ color: "primary" }}
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
            handleResult={this.updateRecipientHandler.bind(this)}
            history={this.props.history}
          />
        </Modal>
        <Grid item xs={12}>
          <Grid
            container
            spacing={8}
            direction="row"
            alignItems="center"
            justify="center"
          >
            <Grid item xs={6}>
              <Button
                className={classes.button}
                fullWidth
                onClick={() => this.withdrawalHandler(true)}
                disabled={!connextState || hasPendingOps(channelState)}
              >
                Cash Out Eth
                <img
                  src={EthIcon}
                  style={{ width: "15px", height: "15px", marginLeft: "5px" }}
                  alt=""
                />
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                className={classes.button}
                variant="contained"
                fullWidth
                onClick={() => this.withdrawalHandler(false)}
                disabled
              >
                Cash Out Dai
                <img
                  src={DaiIcon}
                  style={{ width: "15px", height: "15px", marginLeft: "5px" }}
                  alt=""
                />
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
          <Grid item xs={12} style={{paddingTop:"10%"}}>
            {this.state.withdrawing && <CircularProgress color="primary" />}
          </Grid>
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles)(CashOutCard);
