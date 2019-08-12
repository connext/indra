import { Button, Grid, Tooltip, Typography, withStyles } from "@material-ui/core";
import React, { Component } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { QRGenerate } from "./qrCode";
import MySnackbar from "./snackBar";

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
});

class DepositCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      copied: false
    };
  }

  closeModal = async () => {
    await this.setState({ copied: false });
  };

  render() {
    const { address, history, maxDeposit, minDeposit } = this.props;
    const { copied } = this.state;
    const minEth = minDeposit ? minDeposit.toETH().format() : '?.??'
    const maxEth = maxDeposit ? maxDeposit.toETH().format() : '?.??'
    const maxDai = maxDeposit ? maxDeposit.toDAI().format() : '?.??'
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
          onClose={() => this.closeModal()}
          message="Copied!"
        />
        <Grid item xs={12} margin="1em">
          <QRGenerate value={address} />
        </Grid>
        <Grid item xs={12}>
          <CopyToClipboard
            onCopy={() => this.setState({ copied: true })}
            text={address}
          >
            <Button variant="outlined" fullWidth>
              <Typography noWrap variant="body1">
                <Tooltip
                  disableFocusListener
                  disableTouchListener
                  title="Click to Copy"
                >
                  <span>{address}</span>
                </Tooltip>
              </Typography>
            </Button>
          </CopyToClipboard>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2">
            <span> Send funds to this address to deposit. </span>
          </Typography>
          <Typography variant="body2">
            <Tooltip
              disableFocusListener
              disableTouchListener
              title="Because gas"
            >
              <span>{`Deposit minimum of: ${minEth || "?.??"}.`}</span>
            </Tooltip>
          </Typography>
          <Typography variant="body2">
            <span>{`Up to ${maxEth || "?.??"} Eth 
                      or ${maxDai || "?.??"} Dai will be deposited into the state channel, any leftovers will be kept on-chain`}</span>
          </Typography>
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
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles)(DepositCard);
