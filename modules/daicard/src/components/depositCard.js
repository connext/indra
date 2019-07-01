import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import DepositIcon from "@material-ui/icons/AttachMoney";
import Tooltip from "@material-ui/core/Tooltip";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import QRGenerate from "./qrGenerate";
import MySnackbar from "./snackBar";
import { withStyles } from "@material-ui/core";

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
      value: "0",
      error: null,
      copied: false
    };
  }

  closeModal = async () => {
    await this.setState({ copied: false });
  };

  render() {
    const { classes, address, minDeposit, maxDeposit } = this.props;
    const { copied } = this.state;

    
    const minEth = minDeposit ? minDeposit.toETH().format() : '?.??'
    const maxEth = maxDeposit ? maxDeposit.toETH().format() : '?.??'
    const maxDai = maxDeposit ? maxDeposit.toDAI().format() : '?.??'

    return (
      <Grid
        container
        spacing={16}
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
        <Grid
          container
          wrap="nowrap"
          direction="row"
          justify="center"
          alignItems="center"
        >
          <Grid item xs={12}>
            <DepositIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2">
            <Tooltip
              disableFocusListener
              disableTouchListener
              title="Because gas"
            >
              <span>{`Deposit minimum of: ${minEth || "?.??"}.`}</span>
            </Tooltip>
          </Typography>
        </Grid>
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
            <span>{`Deposits over ${maxEth || "?.??"} Eth 
                      or ${maxDai || "?.??"} Dai will be refunded`}</span>
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
            onClick={() => this.props.history.push("/")}
          >
            Back
          </Button>
        </Grid>
      </Grid>
    );
  }
}

export default withStyles(styles)(DepositCard);
