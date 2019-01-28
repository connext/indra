import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import TextField from "@material-ui/core/TextField";
import Switch from "@material-ui/core/Switch";
import HelpIcon from "@material-ui/icons/Help";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";

class WithdrawCard extends Component {
  state = {
    checkedA: true,
    checkedB: true,
    anchorEl: null,
    withdrawalVal: {
      withdrawalWeiUser: "0",
      tokensToSell: "0",
      withdrawalTokenUser: "0",
      weiToSell: "0",
      exchangeRate: "0.00",
      recipient: "0x0"
    },
    displayVal: "0",
    recipientDisplayVal: "0x0..."
  };

  handleClick = event => {
    console.log("click handled");
    this.setState({
      anchorEl: event.currentTarget
    });
  };

  handleClose = () => {
    this.setState({
      anchorEl: null
    });
  };

  handleChange = name => event => {
    var withdrawalValWei = this.state.withdrawalVal.weiToSell;
    var withdrawalValToken = this.state.withdrawalVal.tokensToSell;
    this.setState({ [name]: event.target.checked });
    if (this.state.checkedB) {
      this.setState({ displayVal: withdrawalValWei });
    } else {
      this.setState({ displayVal: withdrawalValToken });
    }
    console.log(`displaying: ${this.state.displayVal}`);
  };

  async updateWithdrawHandler(evt) {
    this.setState({
      displayVal: evt.target.value
    });
    var value = evt.target.value;
    if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.withdrawalVal.withdrawalWeiUser = value;
        return oldState;
      });
    } else if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.withdrawalVal.tokensToSell = value;
        return oldState;
      });
    }
    console.log(
      `Updated withdrawalVal: ${JSON.stringify(
        this.state.withdrawalVal,
        null,
        2
      )}`
    );
  }

  async updateRecipientHandler(evt) {
    var value = evt.target.value;
    this.setState({
      recipientDisplayVal: evt.target.value
    });
    await this.setState(oldState => {
      oldState.withdrawalVal.recipient = value;
      return oldState;
    });
    console.log(
      `Updated recipient: ${JSON.stringify(
        this.state.withdrawalVal.recipient,
        null,
        2
      )}`
    );
  }

  async withdrawalHandler(max) {
    let withdrawalVal = {
      ...this.state.withdrawalVal,
      exchangeRate: this.props.exchangeRate
    };
    if (max) {
      withdrawalVal.recipient = this.props.metamask.address;
      withdrawalVal.tokensToSell = this.props.tokenBalance;
      withdrawalVal.withdrawalWeiUser = this.props.balance;
    }
    console.log(
      `Withdrawing: ${JSON.stringify(this.state.withdrawalVal, null, 2)}`
    );
    let withdrawalRes = await this.props.connext.withdraw(withdrawalVal);
    console.log(`Withdrawal result: ${JSON.stringify(withdrawalRes, null, 2)}`);
  }

  render() {
    const { anchorEl } = this.state;
    const open = Boolean(anchorEl);

    const cardStyle = {
      card: {
        display: "flex",
        flexWrap: "wrap",
        flexBasis: "100%",
        flexDirection: "row",
        width: "230px",
        height: "300px",
        justifyContent: "center",
        backgroundColor: "#D5D9DF",
        padding: "4% 4% 4% 4%"
      },
      icon: {
        width: "50px",
        height: "50px",
        paddingTop: "10px"
      },
      input: {
        width: "100%",
        height: "50px"
      },
      button: {
        width: "100%",
        height: "40px",
        backgroundColor: "#7b90b1",
        color: "#FFF"
      },
      row: {
        width: "100%"
      },
      col1: {
        marginLeft: "55px",
        width: "40%",
        justifyContent: "'flex-end' !important"
      },
      col2: {
        width: "3%",
        justifyContent: "'flex-end' !important"
      },
      popover: {
        padding: "8px 8px 8px 8px"
      }
    };

    return (
      <Card style={cardStyle.card}>
        <div style={cardStyle.col1}>
          <UnarchiveIcon style={cardStyle.icon} />
        </div>
        <div>
          ETH
          <Switch
            checked={this.state.checkedB}
            onChange={this.handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
          TST
        </div>
        <TextField
          style={cardStyle.input}
          id="outlined-with-placeholder"
          label="Address"
          value={this.state.recipientDisplayVal}
          onChange={evt => this.updateRecipientHandler(evt)}
          placeholder="Receiver (0x0...)"
          margin="normal"
          variant="outlined"
        />
        <TextField
          style={cardStyle.input}
          id="outlined-number"
          label="Amount (Wei)"
          placeholder="Amount (Wei)"
          value={this.state.displayVal}
          onChange={evt => this.updateWithdrawHandler(evt)}
          type="number"
          margin="normal"
          variant="outlined"
        />
        <Button
          style={cardStyle.button}
          onClick={() => this.withdrawalHandler()}
          variant="contained"
        >
          Withdraw
        </Button>
      </Card>
    );
  }
}

export default WithdrawCard;
