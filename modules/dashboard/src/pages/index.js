import React from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import withRoot from "../withRoot";
import Dashboard from "../components/Dashboard";
import Web3 from "web3";
const ChannelManagerAbi = require("../abi/ChannelManager.json");
const TokenAbi = require("../abi/Token.json");

const styles = theme => ({
  root: {
    textAlign: "center",
    paddingTop: theme.spacing.unit * 20
  }
});

class Index extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      web3: new Web3(this.props.urls.eth),
      channelManager: {
        address: "0x0",
        wei: {
          raw: 0,
          formatted: 0
        },
        token: {
          raw: 0,
          formatted: 0
        }
      },
      hubWallet: {
        address: "0x0",
        wei: {
          raw: 0,
          formatted: 0
        },
        token: {
          raw: 0,
          formatted: 0
        }
      }
    };
  }

  async componentDidMount() {
    await this.getHubConfig();
    await this.getContractInfo();
    await this.getWalletInfo(this.state.hubWallet.address);
  }

  async getHubConfig() {
    const config = await (await fetch(`${this.props.urls.hub}/config`)).json();
    console.log(`Got hub config: ${JSON.stringify(config, null, 2)}`);
    this.setState(state => {
      state.tokenAddress = config.tokenAddress.toLowerCase();
      state.channelManager.address = config.channelManagerAddress.toLowerCase();
      state.hubWallet.address = config.hubWalletAddress.toLowerCase();
      return state;
    });
  }

  getWalletInfo = async address => {
    const { web3 } = this.state;
    this.setState({
      loadingWallet: true
    });
    const wei = await web3.eth.getBalance(address);
    console.log("wallet wei: ", wei);
    const tokenContract = new web3.eth.Contract(
      TokenAbi.abi,
      this.state.tokenAddress
    );
    const token = (await tokenContract.methods.balanceOf(address).call())[0];
    console.log("wallet token: ", token);
    this.setState(state => {
      state.hubWallet.wei.raw = wei;
      state.hubWallet.wei.formatted = web3.utils.fromWei(wei);
      state.hubWallet.token.raw = token;
      state.hubWallet.token.formatted = web3.utils.fromWei(token);
      state.loadingWallet = false;
      return state;
    });
  };

  getContractInfo = async () => {
    const { web3 } = this.state;
    this.setState({
      loadingContract: true
    });
    console.log(
      "Investigating contract at:",
      this.state.channelManager.address
    );
    const cm = new web3.eth.Contract(
      ChannelManagerAbi.abi,
      this.state.channelManager.address
    );
    const wei = await cm.methods.getHubReserveWei().call();
    console.log("contract wei: ", wei);
    const weiFormatted = web3.utils.fromWei(wei);
    console.log("contract wei formatted: ", weiFormatted);
    const token = await cm.methods.getHubReserveTokens().call();
    console.log("contract token: ", token);
    this.setState(state => {
      state.channelManager.wei.raw = wei;
      state.channelManager.wei.formatted = weiFormatted;
      state.channelManager.token.raw = token;
      state.channelManager.token.formatted = web3.utils.fromWei(token);
      state.loadingContract = false;
      return state;
    });
  };

  render() {
    const { classes } = this.props;
    const { web3, hubWallet, channelManager } = this.state;
    console.log(hubWallet);
    return (
      <div className={classes.root}>
        <Dashboard
          hubWallet={hubWallet}
          channelManager={channelManager}
          web3={web3}
          urls={this.props.urls}
          getContractInfo={this.getContractInfo}
          getWalletInfo={this.getWalletInfo}
        />
      </div>
    );
  }
}

Index.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withRoot(withStyles(styles)(Index));
