import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  withStyles,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { ArrowRight as SubmitIcon } from "@material-ui/icons";
import React, { useState } from "react";

import Copyable from "./copyable";
import { MySnackbar } from "./snackBar";

const styles = {
  top: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justifyContent: "center",
  },
  card: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "70%",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: "4% 4% 4% 4%",
  },
  icon: {
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },
  supportButton: {
    border: "1px solid #7289da",
    color: "#7289da",
  },
  burnCardButton: {
    border: "1px solid #F22424",
    backgroundColor: "#282b2e",
    color: "#F22424",
  },
  burnCardButtonMargin: {
    backgroundColor: "#282b2e",
    border: "1px solid #F22424",
    color: "#F22424",
    marginLeft: "5%",
  },
  button: {
    marginBottom: 0,
  },
  walletConnextButton: {
    color: "#FFF",
    border: "1px solid #FFFFFF",
  },
  importInput: {
    height: "40px",
    width: "100%",
  },
  recoverAdornment: {
    color: "#FFF",
    marginRight: "-10%",
  },
  dialogWrapper: {
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    backgroundColor:"#282B2E"
  },
  dialogGrid: {
    backgroundColor: "#FFF",
    padding: "3% 3% 3% 3%",
    flexDirection: "column",
    backgroundColor:"#282B2E"
  },
  dialogTextRed: {
    color: "#F22424",
  },
};

const SettingsCard = props => {
  const [copied, setCopied] = useState(false);
  const [inputRecovery, setInputRecovery] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const { classes, setWalletConnext, getWalletConnext, store } = props;
  const useWalletConnext = getWalletConnext()

  const generateNewAddress = async () => {
    setIsBurning(true);
    store && await store.reset(); // remove anything in the store related to the old channel
    localStorage.removeItem("mnemonic", mnemonic);
    window.location.reload();
  };

  const recoverAddressFromMnemonic = async () => {
    store && await store.reset(); // remove anything in the store related to the old channel
    localStorage.setItem("mnemonic", mnemonic);
    window.location.reload();
  };

  const closeModal = () => {
    setCopied(false);
  };

  return (
    <Grid container spacing={2} direction="column" className={classes.top}>
      <MySnackbar
        variant="success"
        openWhen={copied}
        onClose={() => closeModal()}
        message="Copied!"
      />

      <Grid item xs={12} className={classes.button}>
        <Button
          disableTouchRipple
          fullWidth
          className={classes.supportButton}
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
        <Button
          disableTouchRipple
          fullWidth
          className={classes.walletConnextButton}
          size="large"
          onClick={() => {
            setWalletConnext(!useWalletConnext);
          }}
        >
          {useWalletConnext ? `Deactivate WalletConnext (beta)` : `Activate WalletConnext (beta)`}
        </Button>
      </Grid>

      <Grid item xs={12} className={classes.button}>
        {!showRecovery ? (
          <Button
            disableTouchRipple
            fullWidth
            className={classes.button}
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => {
              setShowRecovery(true);
            }}
          >
            Show Backup Phrase
          </Button>
        ) : (
          <Copyable color="inherit" size="large" text={localStorage.getItem("mnemonic")} />
        )}
      </Grid>

      <Grid item xs={12} className={classes.button}>
        {!inputRecovery ? (
          <Button
            disableTouchRipple
            fullWidth
            className={classes.button}
            color="primary"
            variant="outlined"
            size="large"
            onClick={() => setInputRecovery(true)}
          >
            Import from Backup
          </Button>
        ) : (
          <TextField
            className={classes.importInput}
            color="primary"
            variant="outlined"
            size="large"
            placeholder="Enter backup phrase"
            value={mnemonic}
            onChange={event => setMnemonic(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    className={classes.recoverAdornment}
                    disableTouchRipple
                    fullWidth
                    variant="contained"
                    color="primary"
                    style={{}}
                    onClick={() => recoverAddressFromMnemonic()}
                  >
                    <SubmitIcon />
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        )}
      </Grid>

      <Grid item xs={12} className={classes.button}>
        <Button
          disableTouchRipple
          fullWidth
          className={classes.burnCardButton}
          size="large"
          onClick={() => setShowWarning(true)}
        >
          Burn Card
        </Button>
        <Dialog
          open={showWarning}
          onBackdropClick={() => setShowWarning(false)}
          fullWidth
          className={classes.dialogWrapper}
        >
          <Grid className={classes.dialogGrid} container style={{}}>
            <DialogTitle disableTypography>
              <Typography variant="h5" className={classes.dialogTextRed}>
                Are you sure you want to burn your Card?
              </Typography>
            </DialogTitle>
            <DialogContent>
              {isBurning ? (
                <Grid item xs={12}>
                  <DialogContentText className={classes.dialogTextRed} variant="body1">
                    Burning. Please do not refresh or navigate away. This page will refresh
                    automatically when it's done.
                  </DialogContentText>
                  <CircularProgress style={{ marginTop: "1em" }} />
                </Grid>
              ) : (
                <Grid container alignItems="center" justify="center" direction="column">
                  <Grid item xs={12}>
                    <DialogContentText className={classes.dialogTextRed} variant="body1" style={{}}>
                      You will lose access to your funds unless you save your backup phrase!
                    </DialogContentText>
                  </Grid>
                  <Grid item xs={12}>
                    <DialogActions>
                      <Button
                        disableTouchRipple
                        className={classes.burnCardButton}
                        size="small"
                        onClick={() => generateNewAddress()}
                      >
                        Burn
                      </Button>
                      <Button
                        disableTouchRipple
                        className={classes.burnCardButtonMargin}
                        size="small"
                        onClick={() => setShowWarning(false)}
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
    </Grid>
  );
};

SettingsCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SettingsCard);
