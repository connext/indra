import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import TextField from "@material-ui/core/TextField";
import Switch from "@material-ui/core/Switch";
import Tooltip from "@material-ui/core/Tooltip";
import InputAdornment from "@material-ui/core/InputAdornment";

class WithdrawCard extends Component {
  state = {
    checkedA: true,
    checkedB: false,
    anchorEl: null,
    withdrawalVal: {
      withdrawalWeiUser: "0",
      tokensToSell: "0",
      withdrawalTokenUser: "0",
      weiToSell: "0",
      exchangeRate: "0.00",
      recipient: "0x0..."
    },
    displayVal: "0",
    recipientDisplayVal: "0x0...",
    addressError: null,
    balanceError: null
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
    const { channelState } = this.props
    const withdrawalVal = this.state.withdrawalVal;
    let displayed = this.state.displayVal;
    this.setState({ [name]: event.target.checked });
    let updatedWithdrawalVal
    let tokensToSell = '0'
    let withdrawalWeiUser = '0'
    if (this.state.checkedB) {
      if (this.state.clickedMax) {
        displayed = channelState.balanceWeiUser
        tokensToSell = channelState.balanceTokenUser
      }
      updatedWithdrawalVal = { ...withdrawalVal, tokensToSell, withdrawalWeiUser: displayed }
    } else {
      if (this.state.clickedMax) {
        displayed = channelState.balanceTokenUser
        withdrawalWeiUser = channelState.balanceWeiUser
      }
      updatedWithdrawalVal = { ...withdrawalVal, withdrawalWeiUser, tokensToSell: displayed}
    }
    this.setState({ withdrawalVal: updatedWithdrawalVal, displayVal: displayed })
    console.log('displayVal:', displayed)
    console.log(`Updated Withdrawal: ${JSON.stringify(updatedWithdrawalVal, null, 2)}`);
  };

  async updateWithdrawHandler(evt) {
    var value = evt.target.value;
    this.setState({ clickedMax: false, displayVal: value })
    if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.withdrawalVal.withdrawalWeiUser = value;
        oldState.withdrawalVal.tokensToSell = '0';
        return oldState;
      });
    } else if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.withdrawalVal.tokensToSell = value;
        oldState.withdrawalVal.withdrawalWeiUser = '0';
        return oldState;
      });
    }
    console.log(`Updated withdrawalVal: ${JSON.stringify(this.state.withdrawalVal, null, 2)}`);
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
    console.log(`Updated recipient: ${JSON.stringify(this.state.withdrawalVal.recipient, null, 2)}`);
  }

  async maxHandler() {
    this.setState({ clickedMax: true })
    let withdrawalVal = {
      ...this.state.withdrawalVal,
      tokensToSell: this.props.channelState.balanceTokenUser,
      withdrawalWeiUser: this.props.channelState.balanceWeiUser,
    };

    // i dont think we need the aggregate balance here, i think we can show both ETH and Token withdrawals separately
    if (this.state.checkedB) {
      this.setState({ displayVal: withdrawalVal.tokensToSell, withdrawalVal });
    } else {
      this.setState({ displayVal: withdrawalVal.withdrawalWeiUser, withdrawalVal });
    }
    console.log('Updated withdrawal val:', JSON.stringify(withdrawalVal, null, 2))
  }

  async withdrawalHandler() {
    const minWithdrawal = process.env.REACT_APP_WITHDRAWAL_MINIMUM
    let withdrawalVal = {
      ...this.state.withdrawalVal,
      exchangeRate: this.props.exchangeRate
    };
    console.log(`Withdrawing: ${JSON.stringify(this.state.withdrawalVal, null, 2)}`);
    this.setState({addressError: null, balanceError: null})
    const { connext, web3, connextState } = this.props;
    if (!connextState || !connextState.runtime.canWithdraw) {
      console.log('Cannot withdraw')
      return
    }
    if (web3.utils.isAddress(withdrawalVal.recipient)){
      await connext.withdraw(withdrawalVal);
    } else {
      this.setState({addressError: "Please enter a valid address"})
    }
    // check that the balance is above the minimum
    if ( // withdrawaing only wei
      withdrawalVal.withdrawalWeiUser !== "0" &&
      withdrawalVal.tokensToSell === "0" &&
      web3.utils.toBN(withdrawalVal.withdrawalWeiUser).lt(web3.utils.toBN(minWithdrawal))
    ) {
      this.setState({ balanceError: `Below minimum withdrawal amount of ${minWithdrawal} wei`})
    } else if ( // only withdrawaing tokens
      withdrawalVal.tokensToSell !== "0" &&
      withdrawalVal.withdrawalWeiUser === "0" &&
      web3.utils.toBN(withdrawalVal.tokensToSell).lt(web3.utils.toBN(minWithdrawal))
    ) {
      this.setState({ balanceError: `Below minimum withdrawal amount of ${minWithdrawal} tokens`})
    } else if ( // max is selected, check both wei and tokens
      this.state.clickedMax &&
      (
        web3.utils.toBN(withdrawalVal.tokensToSell).lt(web3.utils.toBN(minWithdrawal)) &&
        web3.utils.toBN(withdrawalVal.withdrawalWeiUser).lt(web3.utils.toBN(minWithdrawal))
      )
    ) {
      this.setState({ balanceError: `Below minimum withdrawal amount at maximum withdrawal. `})
    } else if ( // check zero balances
      withdrawalVal.withdrawalWeiUser === '0' &&
      withdrawalVal.tokensToSell === "0"
    ) {
      this.setState({ balanceError: `Enter a withdrawal amount above 0`})
    }
  }

  render() {
    const { connextState } = this.props

    const cardStyle = {
      card: {
        display: "flex",
        flexWrap: "wrap",
        flexBasis: "100%",
        flexDirection: "row",
        width: "230px",
        height: "300px",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
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
        backgroundColor: "#FCA311",
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
            //disabled={true}
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
          helperText={this.state.addressError}
          error={this.state.addressError !== null}
        />
        <TextField
          style={cardStyle.input}
          id="outlined-number"
          label="Amount (Wei)"
          placeholder="Amount (Wei)"
          value={this.state.clickedMax ? "Max Selected" : this.state.displayVal}
          onChange={evt => this.updateWithdrawHandler(evt)}
          type={this.state.clickedMax ? "string" : "number"}
          margin="normal"
          variant="outlined"
          helperText={this.state.balanceError}
          error={this.state.balanceError !== null}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip disableFocusListener disableTouchListener title="Withdraw all funds (ETH and TST) from channel">
                  <div>
                    <Button variant="outlined" onClick={() => this.maxHandler()} disabled={!connextState || !connextState.runtime.canWithdraw}>
                      Max
                    </Button>
                  </div>
                </Tooltip>
              </InputAdornment>
            )
          }}
        />
        <Tooltip disableFocusListener disableTouchListener title="TST will be converted to ETH on Withdraw">
          <div>
            <Button style={cardStyle.button} onClick={() => this.withdrawalHandler(true)} variant="contained" disabled={!connextState || !connextState.runtime.canWithdraw}>
              <span>Withdraw</span>
            </Button>
          </div>
        </Tooltip>
      </Card>
    );
  }
}

export default WithdrawCard;
