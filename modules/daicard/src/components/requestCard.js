import {
  Button,
  Grid,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { Component } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { Currency } from "../utils";

import { QRGenerate } from "./qrCode";
import MySnackbar from "./snackBar";

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
});

class RequestCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      displayValue: "",
      error: null,
      qrUrl: this.generateQrUrl("0"),
      copied: false
    };
  }

  closeModal() {
    this.setState({ copied: false });
  };

  generateQrUrl(value) {
    return `${window.location.origin}/send?` +
      `amountToken=${value || "0"}&` +
      `recipient=${this.props.xpub}`;
  }

  handleCopy() {
    this.setState({ copied: this.state.error ? false : true })
  }

  updatePaymentHandler(rawValue) {
    let value, error
    const { maxDeposit } = this.props
    try {
      value = Currency.DAI(rawValue)
    } catch (e) {
      error = e.message
    }
    if (value && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`
    }
    if (value && value.wad.lte(Zero)) {
      error = "Please enter a payment amount above 0"
    }
    this.setState({
      qrUrl: this.generateQrUrl(error ? "0" : value.amount),
      displayValue: rawValue,
      error,
    });
  };

  render() {
    const { xpub } = this.props;
    const { qrUrl, error, displayValue, copied } = this.state;
    return (
      <Grid
        container
        spacing={2}
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
          onClose={this.closeModal.bind(this)}
          message="Copied!"
        />
        <Grid item xs={12}>
          <QRGenerate value={qrUrl} />
        </Grid>
        <Grid item xs={12}>
          <CopyToClipboard
            onCopy={this.handleCopy.bind(this)}
            text={xpub}
          >
            <Button variant="outlined" fullWidth>
              <Typography noWrap variant="body1">
                <Tooltip
                  disableFocusListener
                  disableTouchListener
                  title={"Click to Copy"}
                >
                  <span>{xpub}</span>
                </Tooltip>
              </Typography>
            </Button>
          </CopyToClipboard>
        </Grid>
        <Grid item xs={12}>
          <CopyToClipboard
            onCopy={this.handleCopy.bind(this)}
            text={error ? '' : qrUrl}
          >
            <Button variant="outlined" fullWidth>
              <Typography noWrap variant="body1">
                <Tooltip
                  disableFocusListener
                  disableTouchListener
                  title={this.state.error ? "Fix amount first" : "Click to Copy"}
                >
                  <span>{qrUrl}</span>
                </Tooltip>
              </Typography>
            </Button>
          </CopyToClipboard>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="outlined-number"
            label="Amount"
            value={displayValue}
            type="number"
            margin="dense"
            variant="outlined"
            onChange={evt => this.updatePaymentHandler(evt.target.value)}
            error={!!error}
            helperText={error}
          />
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

export default withStyles(styles)(RequestCard);
