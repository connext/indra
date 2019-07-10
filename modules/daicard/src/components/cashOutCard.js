import {
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  Modal,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Unarchive as UnarchiveIcon } from "@material-ui/icons";
import { ethers as eth } from "ethers";
import interval from "interval-promise";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { Component } from "react";

import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import { hasPendingTransaction, toBN } from "../utils";

import { QRScan } from "./qrCode";

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
    width: theme.spacing(50),
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(4),
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
      withdrawing: false
    };
  }

  async updateWithdrawalVals(withdrawEth) {
    this.setState({ withdrawEth });

    // set the state to contain the proper withdrawal args for
    // eth or dai withdrawal
    const { channelState, exchangeRate } = this.props
    let { withdrawalVal } = this.state;

    if (withdrawEth && channelState) {
      const amountToken = toBN(channelState.balanceTokenUser)
      const amountWei = toBN(channelState.balanceWeiUser)
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
    // TODO: actually withdraw here

    this.poller();
  }

  render() {
    const { classes, exchangeRate } = this.props;
    const {
      recipientDisplayVal,
      addressError,
      scan,
    } = this.state;
    return (
      <Grid
        container
        spacing={2}
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
              <span>
                {this.props.balance.channel.ether.toETH().toString()}
              </span>
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
                disabled={true/* TODO: enable when withdraw is ready */}
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
