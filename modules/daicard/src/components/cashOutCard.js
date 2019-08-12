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
import { AddressZero, Zero } from "ethers/constants";
import { arrayify, isHexString } from "ethers/utils";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { Component } from "react";

import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import { inverse } from "../utils";

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
      recipient: {
        display: "",
        value: undefined,
        error: undefined,
      },
      scan: false,
      withdrawing: false
    };
  }

  async updateRecipientHandler(value) {
    let recipient = value
    let error
    if (value.includes("ethereum:")) {
      recipient = value.split(":")[1]
    }
    if (recipient === "") {
      error = "Please provide an address"
    } else if (!isHexString(recipient)) {
      error = `Invalid hex string: ${recipient}`
    } else if (arrayify(recipient).length !== 20) {
      error = `Invalid length: ${recipient}`
    }
    this.setState({
      recipient: {
        display: value,
        value: error ? undefined : recipient,
        error,
      },
      scan: false
    });
  }

  async withdrawalTokens() {
    const { balance, channel, history, setPending, swapRate, token } = this.props
    const recipient = this.state.recipient.value
    if (!recipient) return
    const total = balance.channel.total
    if (total.wad.lte(Zero)) return

    // Put lock on actions, no more autoswaps until we're done withdrawing
    setPending({ type: "withdrawal", complete: false, closed: false })
    this.setState({ withdrawing: true });
    console.log(`Withdrawing ${total.toETH().format()} to: ${recipient}`);

    const result = await channel.withdraw({
      amount: balance.channel.token.wad.toString(),
      assetId: token.address,
      recipient,
    });

    console.log(`Cashout result: ${JSON.stringify(result)}`)
    this.setState({ withdrawing: false })
    setPending({ type: "withdrawal", complete: true, closed: false })
    history.push("/")
  }

  async withdrawalEther() {
    const { balance, channel, history, setPending, swapRate, token } = this.props
    const recipient = this.state.recipient.value
    if (!recipient) return
    const total = balance.channel.total
    if (total.wad.lte(Zero)) return

    // Put lock on actions, no more autoswaps until we're done withdrawing
    setPending({ type: "withdrawal", complete: false, closed: false })
    this.setState({ withdrawing: true });
    console.log(`Withdrawing ${total.toETH().format()} to: ${recipient}`);

    // swap all in-channel tokens for eth
    if (balance.channel.token.wad.gt(Zero)) {
      await channel.addPaymentProfile({
        amountToCollateralize: total.toETH().wad.toString(),
        minimumMaintainedCollateral: total.toETH().wad.toString(),
        tokenAddress: AddressZero,
      });
      await channel.requestCollateral(AddressZero);
      await channel.swap({
        amount: balance.channel.token.wad.toString(),
        fromAssetId: token.address,
        swapRate: inverse(swapRate),
        toAssetId: AddressZero,
      });
      await this.props.refreshBalances()
    }

    const result = await channel.withdraw({
      amount: balance.channel.ether.wad.toString(),
      assetId: AddressZero,
      recipient,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`)
    this.setState({ withdrawing: false })
    setPending({ type: "withdrawal", complete: true, closed: false })
    history.push("/")
  }

  render() {
    const { balance, classes, swapRate, history } = this.props;
    const { recipient, scan, withdrawing } = this.state;
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
                {balance.channel.total.toDAI().format()}
              </span>
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption">
            <span>{"ETH price: $" + swapRate}</span>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            style={{ width: "100%" }}
            id="outlined-with-placeholder"
            label="Address"
            placeholder="0x0..."
            value={recipient.display || ""}
            onChange={evt => this.updateRecipientHandler(evt.target.value)}
            margin="normal"
            variant="outlined"
            required
            helperText={recipient.error}
            error={!!recipient.error}
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
            history={history}
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
                onClick={() => this.withdrawalEther()}
                disabled={!recipient.value}
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
                onClick={() => this.withdrawalTokens()}
                disabled={!recipient.value}
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
            onClick={() => history.push("/")}
          >
            Back
          </Button>
          <Grid item xs={12} style={{paddingTop:"10%"}}>
            {withdrawing && <CircularProgress color="primary" />}
          </Grid>
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles)(CashOutCard);
