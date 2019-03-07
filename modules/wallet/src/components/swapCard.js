import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import TextField from "@material-ui/core/TextField";
//import HelpIcon from "@material-ui/icons/Help";
//import IconButton from "@material-ui/core/IconButton";
//import Popover from "@material-ui/core/Popover";
//import Typography from "@material-ui/core/Typography";

class SwapCard extends Component {
  state = {
    anchorEl: null,
    displayVal: "0",
    exchangeVal: "0",
    exchangeRate: "0.00",
    error: null
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

  async updateExchangeHandler(evt) {
    var value = evt.target.value;
    this.setState({
      displayVal: evt.target.value
    });
    await this.setState(oldState => {
      oldState.exchangeVal = value;
      return oldState;
    });
    console.log(
      `Updated exchangeVal: ${JSON.stringify(this.state.exchangeVal, null, 2)}`
    );
  }

  async exchangeHandler() {
    console.log(
      `Exchanging: ${JSON.stringify(this.state.exchangeVal, null, 2)}`
    );
    const { channelState, connextState } = this.props
    if (!connextState || !connextState.runtime.canExchange) {
      console.log('Cannot exchange')
      return
    }
    this.setState({ error: null })
    try {
      if(this.state.exchangeVal <= channelState.balanceWeiUser ) {
        await this.props.connext.exchange(
          this.state.exchangeVal,
          "wei"
        );
      } else {
        throw new Error("Insufficient wei balance")
      }
    } catch (e) {
      console.log(`Error: ${e}`)
      this.setState({error: e.message})
    }

  }

  render() {
    //const { anchorEl } = this.state;
    const { connextState } = this.props
    //const open = Boolean(anchorEl);

    const cardStyle = {
      card: {
        display: "flex",
        flexWrap: "wrap",
        flexBasis: "120%",
        flexDirection: "row",
        width: "230px",
        height: "100%",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        padding: "4% 4% 4% 4%"
      },
      icon: {
        width: "50px",
        height: "50px",
        paddingTop: "8px"
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
          <SwapHoriz style={cardStyle.icon} />
        </div>
        <div>Only ETH to Token in-channel swaps are currently available.</div>
        <TextField
          style={cardStyle.input}
          id="outlined-number"
          label="Amount (Wei)"
          value={this.state.displayVal}
          type="number"
          margin="normal"
          variant="outlined"
          onChange={evt => this.updateExchangeHandler(evt)}
          error={this.state.error != null}
          helperText={this.state.error}
        />
        <div>Rate: 1 ETH = {this.props.exchangeRate} TST</div>
        <Button
          style={cardStyle.button}
          onClick={() => this.exchangeHandler()}
          variant="contained"
          disabled={!connextState || !connextState.runtime.canExchange}
        >
          Swap
        </Button>
      </Card>
    );
  }
}

export default SwapCard;
