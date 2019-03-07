import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import SendIcon from "@material-ui/icons/Send";
import TextField from "@material-ui/core/TextField";
//import Switch from "@material-ui/core/Switch";

class PayCard extends Component {
  state = {
    checkedA: true,
    checkedB: false, // default to always being tokens
    anchorEl: null,
    paymentVal: {
      meta: {
        purchaseId: "payment"
      },
      payments: [
        {
          recipient: "0x0",
          amount: {
            amountWei: "0",
            amountToken: "0"
          },
          type: "PT_CHANNEL"
        }
      ]
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
    var valWei = this.state.paymentVal.payments[0].amount.amountWei;
    var valToken = this.state.paymentVal.payments[0].amount.amountToken;
    this.setState({ [name]: event.target.checked });
    if (this.state.checkedB) {
      this.setState({ displayVal: valWei });
    } else {
      this.setState({ displayVal: valToken });
    }
  };

  async updatePaymentHandler(evt) {
    var value = evt.target.value;
    this.setState({
      displayVal: evt.target.value
    });
    if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountWei = value;
        oldState.paymentVal.payments[0].amount.amountToken = "0";
        return oldState;
      });
    } else if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountToken = value;
        oldState.paymentVal.payments[0].amount.amountWei = "0"
        return oldState;
      });
    }
    console.log(
      `Updated paymentVal: ${JSON.stringify(this.state.paymentVal, null, 2)}`
    );
  }

  async updateRecipientHandler(evt) {
    var value = evt.target.value;
    this.setState({
      recipientDisplayVal: evt.target.value
    });
    await this.setState(oldState => {
      oldState.paymentVal.payments[0].recipient = value;
      return oldState;
    });
    console.log(
      `Updated recipient: ${JSON.stringify(
        this.state.paymentVal.payments[0].recipient,
        null,
        2
      )}`
    );
  }

  async paymentHandler() {
    const { channelState } = this.props
    this.setState({addressError: null, balanceError: null})
    const { connext, web3, connextState } = this.props;
    if (!connextState || !connextState.runtime.canBuy) {
      console.log('Cannot buy')
      return
    }

    let foundError = false
    // validate amount
    if(web3.utils.toBN(this.state.paymentVal.payments[0].amount.amountToken).gt(web3.utils.toBN(channelState.balanceTokenUser))) {
      foundError = true
      this.setState({ balanceError: "Payment cannot exceed channel balance" })
    }

    // validate address
    if(!web3.utils.isAddress(this.state.paymentVal.payments[0].recipient)) {
      foundError = true
      this.setState({addressError: "Please choose a valid address"})
    }

    if (!foundError) {
      console.log(
        `Submitting payment: ${JSON.stringify(this.state.paymentVal, null, 2)}`
      );
      let paymentRes = await connext.buy(this.state.paymentVal);
      console.log(`Payment result: ${JSON.stringify(paymentRes, null, 2)}`);
    }
    return
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
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        padding: "4% 4% 4% 4%"
      },
      icon: {
        width: "50px",
        height: "50px",
        paddingTop: "8px",
        right: "0"
      },
      input: {
        width: "100%"
      },
      button: {
        width: "100%",
        height: "40px",
        backgroundColor: "#FCA311",
        color: "#FFF"
      },
      col1: {
        marginLeft: "55px",
        width: "40%"
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
          <SendIcon style={cardStyle.icon} />
        </div>
        <div>
          Enter TST payment
        </div>
        {/* <div>
          ETH
          <Switch
            checked={this.state.checkedB}
            onChange={this.handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
          TST
        </div> */}
        <TextField
          style={cardStyle.input}
          id="outlined-with-placeholder"
          label="Address"
          placeholder="Receiver (0x0...)"
          value={this.state.recipientDisplayVal}
          onChange={evt => this.updateRecipientHandler(evt)}
          margin="normal"
          variant="outlined"
          helperText={this.state.addressError}
          error={this.state.addressError != null}
        />
        <TextField
          style={cardStyle.input}
          id="outlined-number"
          label="Amount (Wei)"
          placeholder="Amount (Wei)"
          value={this.state.displayVal}
          onChange={evt => this.updatePaymentHandler(evt)}
          type="number"
          margin="normal"
          variant="outlined"
          helperText={this.state.balanceError}
          error={this.state.balanceError != null}
        />
        <Button
          style={cardStyle.button}
          onClick={() => this.paymentHandler()}
          variant="contained"
          disabled={!connextState || !connextState.runtime.canBuy}
        >
          Pay
        </Button>
      </Card>
    );
  }
}

export default PayCard;
