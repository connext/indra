import { Button, IconButton, Snackbar, SnackbarContent, withStyles } from "@material-ui/core";
import { amber, green, red } from "@material-ui/core/colors";
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  HourglassFull as HourglassIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from "@material-ui/icons";
import React from "react";
import classNames from "classnames";

const variantIcon = {
  success: CheckCircleIcon,
  warning: HourglassIcon,
  error: ErrorIcon,
  info: InfoIcon,
};

const style = withStyles(theme => ({
  success: {
    backgroundColor: green[600],
  },
  error: {
    backgroundColor: red[600],
  },
  warning: {
    backgroundColor: amber[700],
  },
  icon: {
    fontSize: 20,
  },
  iconVariant: {
    opacity: 0.9,
    marginRight: theme.spacing(1),
  },
  message: {
    display: "flex",
    alignItems: "center",
  },
}));

export const MySnackbar = style(props => {
  const { classes, className, network, variant, openWhen, onClose, message, duration, txHash } = props;
  console.log('network: ', network);
  const Icon = variantIcon[variant];

  let networkPrefix = "";
  if (network && network.chainId === 4) {
    networkPrefix = "rinkeby."
  } else if (network && network.chainId === 42) {
    networkPrefix = "kovan."
  }

  const getActions = () => {
    const actions = [];
    if (txHash) {
      actions.push(
        <Button
          color="secondary"
          size="small"
          key="view"
          href={`https://etherscan.io/tx/${networkPrefix}${txHash}`}
          target="_blank"
        >
          View Tx
        </Button>,
      );
    }
    actions.push(
      <IconButton
        disableTouchRipple
        key="close"
        aria-label="Close"
        color="inherit"
        className={classes.close}
        onClick={onClose}
      >
        <CloseIcon className={classes.icon} />
      </IconButton>,
    );
    return actions;
  };

  return (
    <Snackbar
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      open={openWhen}
      autoHideDuration={duration || 5000}
      onClose={onClose}
    >
      <SnackbarContent
        className={classNames(classes[variant], className)}
        aria-describedby="client-snackbar"
        message={
          <span id="client-snackbar" className={classes.message}>
            <Icon className={classNames(classes.icon, classes.iconVariant)} />
            {message}
          </span>
        }
        action={getActions()}
      />
    </Snackbar>
  );
});
