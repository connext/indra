import { withStyles } from "@material-ui/core";
import React from "react";

import { MySnackbar } from "./snackBar";

const style = withStyles(theme => ({
  margin: {
    margin: theme.spacing(1),
  },
}));

// TODO: close confirmations based on emitted events
export const Confirmations = style(({ machine, network, state }) => {
  return (
    <div>
      <MySnackbar
        variant="info"
        openWhen={state.matches("ready.receiving.pending.show")}
        onClose={() => machine.send("DISMISS_RECEIVE")}
        message="Receiving Transfer."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={state.matches("ready.receiving.success")}
        onClose={() => machine.send("DISMISS_RECEIVE")}
        message="Transfer Receieved!"
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="error"
        openWhen={state.matches("ready.receiving.error")}
        onClose={() => machine.send("DISMISS_RECEIVE")}
        message="Transfer Failed."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={state.matches("ready.deposit.pending.show")}
        onClose={() => machine.send("DISMISS_DEPOSIT")}
        message="Processing deposit..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={state.matches("ready.deposit.success")}
        onClose={() => machine.send("DISMISS_DEPOSIT")}
        message="Pending deposit confirmed!"
        duration={60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={state.matches("ready.withdraw.pending.show")}
        onClose={() => machine.send("DISMISS_WITHDRAW")}
        message="Processing withdrawal..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={state.matches("ready.withdraw.success")}
        onClose={() => machine.send("DISMISS_WITHDRAW")}
        message="Withdraw succeeded!"
        network={network}
        txHash={state.context.txHash}
        duration={60 * 1000}
      />

      <MySnackbar
        variant="info"
        openWhen={state.matches("ready.swap.pending.show")}
        onClose={() => machine.send("DISMISS_SWAP")}
        message="Processing swap..."
        duration={30 * 60 * 1000}
      />

      <MySnackbar
        variant="success"
        openWhen={state.matches("ready.swap.success")}
        onClose={() => machine.send("DISMISS_SWAP")}
        message="Swap was successful!"
        duration={60 * 1000}
      />
    </div>
  );
});
