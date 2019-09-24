import {
  Grid,
  withStyles,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Dialog,
  Typography,
  DialogContentText,
  LinearProgress,
  Tooltip,
} from "@material-ui/core";
import { FileCopy as CopyIcon } from "@material-ui/icons";
import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

const style = withStyles((theme) => ({
  icon: {
    width: "40px",
    height: "40px"
  }
}));

const screens = (classes, minEth, minDai, maxEth, maxDai) => [
  {
    title: "Welcome to Your Dai Card!",
    message: "Here are some helpful tips to get you started with the next generation of payments."
  },
  {
    title: "Beta Software",
    message:
      `This is beta software, and there are still bugs. Don't hesitate to contact us by going to Settings > Support if you find any!`
  },
  {
    title: "Your Mnemonic",
    message:
      "This mnemonic is required to access your card's funds. It's available anytime via the settings page, be sure to write it down somewhere before you deposit money.",
    extra: (
      <Grid container style={{ padding: "2% 2% 2% 2%" }}>
        <CopyToClipboard
          text={localStorage.getItem("mnemonic")}
          color="primary"
        >
          <Button
            fullWidth
            className={classes.button}
            variant="outlined"
            color="primary"
            size="small"
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
      </Grid>
    )
  },
  {
    title: "Deposit Boundaries",
    message: `The card needs a minimum deposit of ${
      minEth || "?.??"} (${ minDai || "?.??"
    }) to cover the gas costs of getting setup. Cards only accept deposits of ${
      maxEth || "?.??"} (${ maxDai || "?.??"
    }) or less, with any excess eth being kept on-chain & not added to the channel.`
  },
  {
    title: "Depositing Tokens",
    message: `If you want to deposit dai directly, there are no deposit maximums enforced! Just make sure to send at least ${
      minEth || "?.??"} (${ minDai || "?.??"
    }) for gas to your new wallet.`
  }
];

export const SetupCard = style((props) => {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(!localStorage.getItem("hasBeenWarned"));

  const { classes, minDeposit, maxDeposit } = props;

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClickNext = () => {
    setIndex(index + 1);
  };

  const handleClickPrevious = () => {
    setIndex(index - 1);
  };

  const handleClose = () => {
    localStorage.setItem("hasBeenWarned", "true");
    setOpen(false);
  };

  // get proper display values
  // max token in DEI, min in wei and DAI
  let minDai, minEth, maxDai, maxEth;

  if (maxDeposit && minDeposit) {
    minEth = minDeposit.toETH().format()
    minDai = minDeposit.toDAI().format();
    maxEth = maxDeposit.toETH().format()
    maxDai = maxDeposit.toDAI().format();
  }

  const display = screens(classes, minEth, minDai, maxEth, maxDai);
  const isFinal = index === display.length - 1;
  const progress = 100 * ((index + 1) / display.length);

  return (
    <Grid
      container
      spacing={8}
      direction="column"
      style={{
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center"
      }}
      item={true}
      zeroMinWidth={true}
    >
      {display.length !== 0 && (
        <Dialog open={open} fullWidth>
          <Grid container justify="center">
            <Grid item xs={12} style={{ padding: "2% 2% 2% 2%" }}>
              <LinearProgress variant="determinate" value={progress} />
            </Grid>

            <Grid item xs={12}>
              <DialogTitle variant="h5">{display[index].title}</DialogTitle>
            </Grid>

            {display[index].extra && (
              <Grid item xs={12}>
                {display[index].extra}
              </Grid>
            )}

            <DialogContent>
              <Grid item xs={12} style={{ padding: "2% 2% 2% 2%" }}>
                <DialogContentText variant="body1">
                  {display[index].message}
                </DialogContentText>
              </Grid>

              <Grid item xs={12}>
                <DialogActions style={{ padding: "2% 2% 2% 2%" }}>
                  {index !== 0 && (
                    <Button
                      onClick={handleClickPrevious}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Back
                    </Button>
                  )}
                  {isFinal ? (
                    <Button
                      onClick={handleClose}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Got it!
                    </Button>
                  ) : (
                    <Button
                      onClick={handleClickNext}
                      className={classes.button}
                      variant="outlined"
                      color="primary"
                      size="small"
                    >
                      Next
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
