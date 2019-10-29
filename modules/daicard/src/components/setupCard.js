import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  LinearProgress,
  withStyles,
} from "@material-ui/core";
import React, { useState } from "react";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px",
  },
}));

const screens = (classes, minEth, minDai, maxEth, maxDai) => [
  {
    title: "Welcome to Your Dai Card!",
    message: "Here are some helpful tips to get you started with the next generation of payments.",
  },
  {
    title: "Your Mnemonic",
    message: `
      A mnemonic is required to access your card's funds.
      Before you deposit or redeem, copy it somewhere you won't lose it.
      You can access your mnemonic anytime via the settings page.
      BEWARE: If you're using an incognito or temporary in-app browser,
      your mnemonic will be burned when you close this page.
    `,
  },
  {
    title: "Deposit Boundaries",
    message: `The card needs a minimum deposit of ${minEth} (${minDai}) to cover the gas costs
      of getting setup. No more than ${maxEth} (${maxDai}) will be added to your channel at a time,
      any excess funds you send will be kept on-chain & not deposited into your channel.`,
  },
];

export const SetupCard = style(({ classes, minDeposit, maxDeposit }) => {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(!localStorage.getItem("hasBeenWarned"));
  const handleClose = () => {
    localStorage.setItem("hasBeenWarned", "true");
    setOpen(false);
  };

  const minEth = minDeposit ? minDeposit.toETH().format() : "$?.??";
  const minDai = minDeposit ? minDeposit.toDAI().format() : "$?.??";
  const maxEth = maxDeposit ? maxDeposit.toETH().format() : "$?.??";
  const maxDai = maxDeposit ? maxDeposit.toDAI().format() : "$?.??";

  const display = screens(classes, minEth, minDai, maxEth, maxDai);
  const isFinal = index === display.length - 1;
  const progress = 100 * ((index + 1) / display.length);

  return (
    <Grid
      container
      spacing={8}
      direction="column"
      style={{
        width: "100%",
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
      }}
      item={true}
      zeroMinWidth={true}
    >
      {display.length !== 0 && (
        <Dialog open={open} fullWidth onBackdropClick={handleClose}>
          <Grid container justify="center">
            <Grid item xs={12} style={{ padding: "2% 2% 2% 2%" }}>
              <LinearProgress variant="determinate" value={progress} />
            </Grid>

            <Grid item xs={12}>
              <DialogTitle variant="h5">{display[index].title}</DialogTitle>
            </Grid>

            <DialogContent>
              <Grid item xs={12} style={{ padding: "2% 2% 2% 2%" }}>
                <DialogContentText variant="body1" style={{ minHeight: "9em" }}>
                  {display[index].message}
                </DialogContentText>
              </Grid>

              <Grid item xs={12}>
                <DialogActions style={{ padding: "2% 2% 2% 2%" }}>
                  {index !== 0 && (
                    <Button
                      disableTouchRipple
                      onClick={() => setIndex(index - 1)}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Back
                    </Button>
                  )}
                  {!isFinal ? (
                    <Button
                      disableTouchRipple
                      onClick={() => setIndex(index + 1)}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      disableTouchRipple
                      onClick={handleClose}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Got it!
                    </Button>
                  )}
                </DialogActions>
              </Grid>
            </DialogContent>
          </Grid>
        </Dialog>
      )}
    </Grid>
  );
});
