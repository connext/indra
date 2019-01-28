import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import ArchiveIcon from "@material-ui/icons/Archive";
import TextField from "@material-ui/core/TextField";
import Switch from "@material-ui/core/Switch";
import HelpIcon from "@material-ui/icons/Help";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";
import { store } from "../App.js";
const Web3 = require("web3");
const eth = require("ethers");

class DepositCard extends Component {
  state = {
    checkedA: true,
    checkedB: false,
    anchorEl: null,
    depositVal: {
      amountWei: "0",
      amountToken: "0"
    },
    displayVal: "0"
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
    var depositValWei = this.state.depositVal.amountWei;
    var depositValToken = this.state.depositVal.amountToken;
    this.setState({ [name]: event.target.checked });
    if (this.state.checkedB) {
      this.setState({ displayVal: depositValWei });
    } else {
      this.setState({ displayVal: depositValToken });
    }
  };

  async updateDepositHandler(evt) {
    var value = evt.target.value;
    this.setState({
      displayVal: evt.target.value
    });
    if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.depositVal.amountWei = value;
        return oldState;
      });
    } else if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.depositVal.amountToken = value;
        return oldState;
      });
    }
    console.log(
      `Updated depositVal: ${JSON.stringify(this.state.depositVal, null, 2)}`
    );
  }

  // deposit handler should simply get amounts from metamask and let the balance poller deposit into the channel
  async depositHandler() {
    try {
      const { usingMetamask, connext } = this.props
      const wei = this.state.depositVal.amountWei;
      const tokens = this.state.depositVal.amountToken;
      console.log(`wei: ${wei}`);
      console.log(`tokens: ${tokens}`);

      // if you are using metamask, deposit directly with connext
      // otherwise, fetch tokens/eth
      if (usingMetamask) {
        console.log(usingMetamask)
        await connext.deposit({ amountWei: wei, amountToken: tokens, recipient: "user" })
      } else {
        if (wei !== "0") {
          console.log("found wei deposit");
          await this.getEther(wei);
        }
  
        if (tokens !== "0") {
          console.log("found token deposit");
          await this.getTokens(tokens);
        }
      }

    } catch (e) {
      console.log(`error fetching deposit from metamask: ${e}`);
    }
  }

  async getTokens(amountToken) {
    const { tokenContract, humanTokenAbi, } = this.props
    let web3 = window.web3;
    console.log(web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new Web3(web3.currentProvider);
    const mmAddr = (await metamaskProvider.eth.getAccounts())[0];
    const browserAddr = store.getState()[0].getAddressString()
    if (!mmAddr) {
      alert("You need to install & unlock metamask to do that");
      return;
    }

    const tc = new metamaskProvider.eth.Contract(
      humanTokenAbi,
      tokenContract.tokenAddress
    );

    console.log(
      `Sending ${amountToken} tokens from ${mmAddr} to ${browserAddr}`
    );

    console.log("state:");
    console.log(this.state);

    const transferTx = await tc.methods
    .transfer(browserAddr, amountToken)
    .send({
      from: mmAddr,
      gas: "81000"
    });
    console.log('Token transfer tx:', transferTx);
    
  }

  // to get tokens from metamask to browser wallet
  async getEther(amountWei) {
    const { usingMetamask, channelManagerAddress, connext } = this.props
    let web3 = window.web3;
    console.log(web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new eth.providers.Web3Provider(
      web3.currentProvider
    );
    const metamask = metamaskProvider.getSigner();
    const mmAddr = (await metamask.provider.listAccounts())[0];
    const browserAddr = store.getState()[0].getAddressString()
    if (!mmAddr) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    // if the autosigner is being used, send to that address
    // otherwise, send from metamask to contract
    try {
      console.log(`Sending eth from ${mmAddr} to ${browserAddr}`)
      let sentTx = await connext.deposit({ amountWei })
      console.log(
        `Eth sent to: ${store.getState()[0].getAddressString()}. Tx: `,
        sentTx
      );
    } catch (e) {
      console.warn(`Error sending transaction: ${e.message}`)
    }
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
        justifyContent: "center",
        backgroundColor: "#D5D9DF",
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
        backgroundColor: "#7b90b1",
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
          <ArchiveIcon style={cardStyle.icon} />
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
          id="outlined-number"
          label="Amount (Wei)"
          value={this.state.displayVal}
          type="number"
          margin="normal"
          variant="outlined"
          onChange={evt => this.updateDepositHandler(evt)}
        />
        <Button
          style={cardStyle.button}
          variant="contained"
          onClick={evt => this.depositHandler(evt)}
        >
          Get from MetaMask
        </Button>
      </Card>
    );
  }
}

export default DepositCard;
