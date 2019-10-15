import { withStyles } from "@material-ui/core";
import React from "react";

import { MySnackbar } from './snackBar';

const style = withStyles(theme => ({
  margin: {
    margin: theme.spacing(1)
  }
}));

// TODO: close confirmations based on emitted events
export const Confirmations = style(props => {
  const { pending, closeConfirmations, network } = props;
  const { type, complete, closed, txHash } = pending;
  return (
    <div>
      <MySnackbar
        variant="warning"
        openWhen={type === "deposit" && !complete && !closed}
        onClose={() => closeConfirmations("deposit")}
        message="Processing deposit, we'll let you know when it's done"
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="warning"
        openWhen={type === "withdrawal" && !complete && !closed}
        onClose={() => closeConfirmations("withdraw")}
        message="Processing withdrawal, we'll let you know when it's done"
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="warning"
        openWhen={type === "swap" && !complete && !closed}
        onClose={() => closeConfirmations("withdraw")}
        message="Processing swap, we'll let you know when it's done"
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={type === "deposit" && complete && !closed}
        onClose={() => closeConfirmations()}
        message="Pending deposit confirmed!"
        duration={60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={type === "withdrawal" && complete && !closed}
        onClose={() => closeConfirmations()}
        message={`Withdraw request submitted to chain`}
        network={network}
        txHash={txHash}
        duration={60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={type === "swap" && complete && !closed}
        onClose={() => closeConfirmations()}
        message="Swap was successful!"
        duration={60 * 1000}
      />

    </div>
  );
})
