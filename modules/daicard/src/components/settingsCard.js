import React, { Component } from "react";
import {
  Button,
  Grid,
  Select,
  MenuItem,
  Typography,
  Tooltip,
  TextField,
  InputAdornment,
  withStyles,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@material-ui/core";
import { CopyToClipboard } from "react-copy-to-clipboard";
import CopyIcon from "@material-ui/icons/FileCopy";
import SubmitIcon from "@material-ui/icons/ArrowRight";
import SettingsIcon from "@material-ui/icons/Settings";
import MySnackbar from "./snackBar";
import interval from "interval-promise";

const styles = {
  card: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "70%",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: "4% 4% 4% 4%"
  },
  icon: {
    width: "40px",
    height: "40px"
  },
  input: {
    width: "100%"
  },
  button: {
    marginBottom: "0px"
  }
};

class SettingsCard extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showRecovery: false,
      inputRecovery: false,
      rpc: localStorage.getItem("rpc-prod"),
      mnemonic: '',
      copied: false,
      showWarning: false
    };
  }

  closeModal = async () => {
    await this.setState({ copied: false });
  };

  generateNewAddress = async () => {
    this.setState({ isBurning: true });
    try {
      await this.props.connext.withdraw({
        withdrawalWeiUser: "0",
        tokensToSell: "0",
        withdrawalTokenUser: "0",
        weiToSell: "0",
        recipient: this.props.address,
        exchangeRate: this.props.exchangeRate
      });
    } catch (e) {
      console.log("Error withdrawing, creating new address anyway", e.message);
    } finally {
      localStorage.removeItem("mnemonic");
      this.burnRefreshPoller();
    }
  };

  burnRefreshPoller = async () => {
    await interval(
      async (iteration, stop) => {
        const { runtime } = this.props
          if (!runtime.awaitingOnchainTransaction) {
            stop()
          }
      },
      1000,
      { iterations: 50 }
    );
    
    // Then refresh the page
    this.props.history.push("/");
    window.location.reload();
  };

  async recoverAddressFromMnemonic() {
    localStorage.setItem("mnemonic", this.state.mnemonic);
    window.location.reload();
  }

  async updateRPC(event) {
    const rpc = event.target.value;
    this.setState({ rpc });
    await this.props.networkHandler(rpc);
    window.location.reload();
  }

  render() {
    const { classes } = this.props;
    const { copied } = this.state;
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
        <MySnackbar
          variant="success"
          openWhen={copied}
          onClose={() => this.closeModal()}
          message="Copied!"
        />
        <Grid item xs={12} style={{ justifyContent: "center" }}>
          <SettingsIcon className={classes.icon} />
        </Grid>
        <Grid item xs={12}>
          <Select
            fullWidth
            value={this.state.rpc}
            onChange={event => this.updateRPC(event)}
            style={{
              border: "1px solid #3CB8F2",
              color: "#3CB8F2",
              textAlign: "center",
              borderRadius: "4px",
              height: "45px"
            }}
            disableUnderline
            IconComponent={() => null}
          >
            <MenuItem value={"MAINNET"}>MAINNET</MenuItem>
            <MenuItem value={"RINKEBY"}>RINKEBY</MenuItem>
            {
              process.env.NODE_ENV === "development"
              ? <MenuItem value={"LOCALHOST"}>LOCALHOST</MenuItem>
              : null
            }
          </Select>
        </Grid>
        <Grid item xs={12} className={classes.button}>
          <Button
            fullWidth
            style={{
              background: "#FFF",
              border: "1px solid #7289da",
              color: "#7289da"
            }}
            onClick={() => {
              window.open("https://discord.gg/q2cakRc", "_blank");
              window.close();
              return false;
            }}
            size="large"
          >
            Support
          </Button>
        </Grid>
        <Grid item xs={12} className={classes.button}>
          {!this.state.showRecovery ? (
            <Button
              fullWidth
              className={classes.button}
              variant="outlined"
              color="primary"
              size="large"
              onClick={() => this.setState({ showRecovery: true })}
            >
              Show Backup Phrase
            </Button>
          ) : (
            <CopyToClipboard
              onCopy={() => this.setState({ copied: true })}
              text={localStorage.getItem("mnemonic")}
              color="primary"
            >
              <Button
                fullWidth
                className={classes.button}
                variant="outlined"
                color="primary"
                size="large"
                onClick={() => this.setState({ showRecovery: true })}
              >
                <CopyIcon style={{ marginRight: "5px" }} />
                <Typography noWrap variant="body1" color="primary">
                  <Tooltip
                    disableFocusListener
                    disableTouchListener
                    title="Click to Copy"
                  >
                    <span>{localStorage.getItem("mnemonic")}</span>
                  </Tooltip>
                </Typography>
              </Button>
            </CopyToClipboard>
          )}
        </Grid>
        <Grid item xs={12} className={classes.button}>
          {!this.state.inputRecovery ? (
            <Button
              fullWidth
              className={classes.button}
              color="primary"
              variant="outlined"
              size="large"
              onClick={() => this.setState({ inputRecovery: true })}
            >
              Import from Backup
            </Button>
          ) : (
            <TextField
              style={{ height: "40px", width: "80%" }}
              color="primary"
              variant="outlined"
              size="large"
              placeholder="Enter backup phrase and submit"
              value={this.state.mnemonic}
              onChange={event =>
                this.setState({ mnemonic: event.target.value })
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      style={{ color: "#FFF", marginRight: "-10%" }}
                      onClick={() => this.recoverAddressFromMnemonic()}
                    >
                      <SubmitIcon />
                    </Button>
                  </InputAdornment>
                )
              }}
            />
          )}
        </Grid>
        <Grid item xs={12} className={classes.button}>
          <Button
            fullWidth
            style={{
              background: "#FFF",
              border: "1px solid #F22424",
              color: "#F22424"
            }}
            size="large"
            onClick={() => this.setState({ showWarning: true })}
          >
            Burn Card
          </Button>
          <Dialog
            open={this.state.showWarning}
            onBackdropClick={() => this.setState({ showWarning: false })}
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
                padding: "3% 3% 3% 3%",
                flexDirection: "column"
              }}
            >
              <DialogTitle disableTypography>
                <Typography variant="h5" style={{ color: "#F22424" }}>
                Are you sure you want to burn your Card?
                </Typography>
              </DialogTitle>
              <DialogContent>
              {this.state.isBurning ? (
                <Grid item xs={12}>
                  <DialogContentText variant="body1">
                    Burning. Please do not refresh or navigate away. This page
                    will refresh automatically when it's done.
                  </DialogContentText>
                  <CircularProgress style={{ marginTop: "1em" }} />
                  </Grid>
              ) : (
                <Grid container alignItems="center" justify="center" direction="column">
                <Grid item xs={12}>
                    <DialogContentText variant="body1" style={{ color: "#F22424" }}>
                      You will lose access to your funds unless you save your
                      backup phrase!
                    </DialogContentText>
                    </Grid>
                    <Grid item xs={12}>
                  <DialogActions>
                    <Button
                      style={{
                        background: "#F22424",
                        border: "1px solid #F22424",
                        color: "#FFF"
                      }}
                      variant="contained"
                      size="small"
                      onClick={() => this.generateNewAddress()}
                    >
                      Burn
                    </Button>
                    <Button
                      style={{
                        background: "#FFF",
                        border: "1px solid #F22424",
                        color: "#F22424",
                        marginLeft: "5%"
                      }}
                      variant="outlined"
                      size="small"
                      onClick={() => this.setState({ showWarning: false })}
                    >
                      Cancel
                    </Button>
                  </DialogActions>
                  </Grid>
                  </Grid>
              )}
              </DialogContent>

            </Grid>
          </Dialog>
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

export default withStyles(styles)(SettingsCard);
