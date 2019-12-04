import { withStyles } from "@material-ui/core";
import React from "react";

import { MySnackbar } from "./snackBar";

const style = withStyles(theme => ({
  margin: {
    margin: theme.spacing(1),
  },
}));

// TODO: close confirmations based on emitted events
export const Confirmations = style(({ machineState, machineAction, network }) => {
  return (
    <div>
      <MySnackbar
        variant="info"
        openWhen={machineState.matches("ready.receiving.pending.show")}
        onClose={() => machineAction("DISMISS_RECEIVE")}
        message="Receiving Transfer."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={machineState.matches("ready.receiving.success")}
        onClose={() => machineAction("DISMISS_RECEIVE")}
        message="Transfer Receieved!"
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="error"
        openWhen={machineState.matches("ready.receiving.error")}
        onClose={() => machineAction("DISMISS_RECEIVE")}
        message="Transfer Failed."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={machineState.matches("ready.deposit.pending.show")}
        onClose={() => machineAction("DISMISS_DEPOSIT")}
        message="Processing deposit..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={machineState.matches("ready.deposit.success")}
        onClose={() => machineAction("DISMISS_DEPOSIT")}
        message="Pending deposit confirmed!"
        duration={60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={machineState.matches("ready.withdraw.pending.show")}
        onClose={() => machineAction("DISMISS_WITHDRAW")}
        message="Processing withdrawal..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={machineState.matches("ready.withdraw.success")}
        onClose={() => machineAction("DISMISS_WITHDRAW")}
        message="Withdraw succeeded!"
        network={network}
        txHash={machineState.context.txHash}
        duration={60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={machineState.matches("ready.swap.pending.show")}
        onClose={() => machineAction("DISMISS_SWAP")}
        message="Processing swap..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={machineState.matches("ready.swap.success")}
        onClose={() => machineAction("DISMISS_SWAP")}
        message="Swap was successful!"
        duration={60 * 1000}
      />
    </div>
  );
});
