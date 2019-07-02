import {
  Button,
  Grid,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { SaveAlt as ReceiveIcon } from "@material-ui/icons";
import { ethers as eth } from "ethers";
import React, { Component } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { getAmountInDAI, toBN } from "../utils";

import QRGenerate from "./qrGenerate";
import MySnackbar from "./snackBar";

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
});

class ReceiveCard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      amountToken: null,
      displayValue: "",
      error: null,
      qrUrl: this.generateQrUrl("0"),
      copied: false
    };
  }

  closeModal = async () => {
    this.setState({ copied: false });
  };

  handleCopy = () => {
    const error = this.validatePayment()
    if (error) {
      this.setState({ copied: false })
      return
    }
    this.setState({ copied: true })
  }

  validatePayment = () => {
    const { amountToken, } = this.state
    const { connextState, maxTokenDeposit, } = this.props
    let error = null
    this.setState({ error: null })
    if (!amountToken) {
      error = "Please enter a valid amount"
      this.setState({ error })
      return error
    }
    const tokentoBN = toBN(amountToken)
    const amount = {
      amountWei: '0',
      amountToken: maxTokenDeposit,
    }
    if (tokentoBN.gt(toBN(amount.amountToken))) {
      error = `Channel balances are capped at ${getAmountInDAI(amount, connextState)}`
    }
    if (tokentoBN.lte(eth.constants.Zero)) {
      error = "Please enter a payment amount above 0"
    }

    this.setState({ error })
    return error
  }

  updatePaymentHandler = async value => {
    // protect against precision errors
    const decimal = (
      value.startsWith('.') ? value.substr(1) : value.split('.')[1]
    )

    let error = null
    let tokenVal = value
    if (decimal && decimal.length > 18) {
      tokenVal = value.startsWith('.') ? value.substr(0, 19) : value.split('.')[0] + '.' + decimal.substr(0, 18)
      error = `Value too precise! Using ${tokenVal}`
    }    
    this.setState({
      qrUrl: this.generateQrUrl(value),
      amountToken: eth.utils.parseEther(tokenVal).toString(),
      displayValue: value,
      error,
    });
  };

  generateQrUrl = value => {
    const { publicUrl, address } = this.props;
    // function should take a payment value
    // and convert it to the url with
    // appropriate strings to prefill a send
    // modal state (recipient, amountToken)
    const url = `${publicUrl || "https:/"}/send?amountToken=${value || "0"}&recipient=${address || eth.constants.AddressZero}`;
    return url;
  };

  render() {
    const { classes } = this.props;
    const { qrUrl, error, displayValue, amountToken, copied } = this.state;
    return (
      <Grid
        container
        spacing={10}
        direction="column"
        style={{
          paddingLeft: "10%",
          paddingRight: "10%",
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justifyContent: "center"
        }}
      >
        <MySnackbar
          variant="success"
          openWhen={copied}
          onClose={this.closeModal}
          message="Copied!"
        />
        <Grid
          container
          wrap="nowrap"
          direction="row"
          justify="center"
          alignItems="center"
        >
          <Grid item xs={12}>
            <ReceiveIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="outlined-number"
            label="Amount"
            value={displayValue}
            type="number"
            margin="normal"
            variant="outlined"
            onChange={evt => this.updatePaymentHandler(evt.target.value)}
            error={error !== null}
            helperText={error}
          />
        </Grid>
        <Grid item xs={12}>
          <QRGenerate value={qrUrl} />
        </Grid>
        <Grid item xs={12}>
          {/* <CopyIcon style={{marginBottom: "2px"}}/> */}
          <CopyToClipboard
            onCopy={this.handleCopy}
            text={(error == null || error.indexOf('too precise') !== -1) && amountToken != null ? qrUrl : ''}
          >
            <Button variant="outlined" fullWidth onClick={this.validatePayment}>
              <Typography noWrap variant="body1">
                <Tooltip
                  disableFocusListener
                  disableTouchListener
                  title="Click to Copy"
                >
                  <span>{qrUrl}</span>
                </Tooltip>
              </Typography>
            </Button>
          </CopyToClipboard>
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
      </Grid>
    );
  }
}

export default withStyles(styles)(ReceiveCard);
