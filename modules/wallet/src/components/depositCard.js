import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import CardActionArea from "@material-ui/core/CardActionArea";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import ArchiveIcon from "@material-ui/icons/Archive";
import TextField from "@material-ui/core/TextField";
import { withStyles } from "@material-ui/core/styles";
import PropTypes from "prop-types";
import Switch from "@material-ui/core/Switch";
import HelpIcon from "@material-ui/icons/Help";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";
import { store } from "../App.js";
const Web3 = require("web3");
const eth = require("ethers");

class DepositCard extends Component {
  constructor(props) {
    super(props);
  }
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
    console.log(`Updated depositVal: ${JSON.stringify(this.state.depositVal, null, 2)}`);
  }

  // deposit handler should simply get amounts from metamask and let the balance poller deposit into the channel
  async depositHandler() {
    const { tokenContract, channelManagerAddress: approveFor } = this.props

    let approveTx = await tokenContract.methods.approve(approveFor, this.state.depositVal);
    console.log(approveTx);

    try {
      const wei = this.state.depositVal.amountWei;
      const tokens = this.state.depositVal.amountToken;
      console.log(`wei: ${wei}`);
      console.log(`tokens: ${tokens}`);

      if (wei !== "0") {
        console.log("found wei deposit");
        await this.getEther(wei);
      }

      if (tokens !== "0") {
        console.log("found token deposit");
        await this.getTokens(tokens);
      }
    } catch (e) {
      console.log(`error fetching deposit from metamask: ${e}`);
    }
  }

  async getTokens(amountToken) {
    let web3 = window.web3;
    console.log(web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new Web3(web3.currentProvider);
    const address = (await metamaskProvider.eth.getAccounts())[0];
    if (!address) {
      alert("You need to install & unlock metamask to do that");
      return;
    }

    const tokenContract = new metamaskProvider.eth.Contract(this.props.humanTokenAbi, this.props.tokenContract.tokenAddress);

    let tokens = amountToken;
    console.log(`Sending ${tokens} tokens from ${address} to ${store.getState()[0].getAddressString()}`);

    console.log("state:");
    console.log(this.state);

    let approveTx = await tokenContract.methods.transfer(store.getState()[0].getAddressString(), tokens).send({
      from: address,
      gas: "81000"
    });

    console.log(approveTx);
  }

  // to get tokens from metamask to browser wallet
  async getEther(amountWei) {
    let web3 = window.web3;
    console.log(web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
    const metamask = metamaskProvider.getSigner();
    const address = (await metamask.provider.listAccounts())[0];
    if (!address) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const sentTx = await metamask.sendTransaction({
      to: store.getState()[0].getAddressString(),
      value: eth.utils.bigNumberify(amountWei),
      gasLimit: eth.utils.bigNumberify("21000")
    });
    console.log(`Eth sent to: ${store.getState()[0].getAddressString()}. Tx: `, sentTx);
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
        backgroundColor: "#EAEBEE",
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
        height: "40px"
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
        <div style={cardStyle.col2}>
          <IconButton
            style={cardStyle.helpIcon}
            aria-owns={open ? "simple-popper" : undefined}
            aria-haspopup="true"
            variant="contained"
            onClick={this.handleClick}
          >
            <HelpIcon />
          </IconButton>
          <Popover
            id="simple-popper"
            open={open}
            anchorEl={anchorEl}
            onClose={this.handleClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "center"
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "center"
            }}
          >
            <Typography style={cardStyle.popover}>
              Get tokens or ETH from your MetaMask. <br />
              Enter the amount in Wei, tokens, or both, and then click Get.{" "}
            </Typography>
          </Popover>
        </div>
        <div>
          ETH
          <Switch checked={this.state.checkedB} onChange={this.handleChange("checkedB")} value="checkedB" color="primary" />
          TST
        </div>
        <div>
          <Typography>
            Get more than 40 Finney (40000000000000000 Wei) ETH.
          </Typography>
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
        <Button style={cardStyle.button} variant="contained" color="primary" onClick={evt => this.depositHandler(evt)}>
          Get
        </Button>
      </Card>
    );
  }
}

export default DepositCard;
