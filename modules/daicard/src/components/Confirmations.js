import React, { Component } from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import MySnackbar from './snackBar';

const styles = theme => ({
  margin: {
    margin: theme.spacing.unit
  }
});

class Confirmations extends Component {
  render() {
    const { type, reset } = this.props.status;
    return (
      <div>

        <MySnackbar
          variant="warning"
          openWhen={type === "DEPOSIT_PENDING" && reset}
          onClose={() => this.props.closeConfirmations("deposit")}
          message="Processing deposit, we'll let you know when it's done."
          duration={30000}
        />

        <MySnackbar
          variant="warning"
          openWhen={type === "WITHDRAWAL_PENDING" && reset}
          onClose={() => this.props.closeConfirmations("withdraw")}
          message="Processing withdrawal, we'll let you know when it's done."
          duration={30000}
        />

        <MySnackbar
          variant="success"
          openWhen={type === "DEPOSIT_SUCCESS" && reset}
          onClose={() => this.props.closeConfirmations()}
          message="Pending deposit confirmed!"
        />

        <MySnackbar
          variant="success"
          openWhen={type === "WITHDRAWAL_SUCCESS" && reset}
          onClose={() => this.props.closeConfirmations()}
          message="Pending withdraw confirmed!"
        />

      </div>
    );
  }
}

Confirmations.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Confirmations);
