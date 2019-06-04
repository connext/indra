import { ethers as eth } from "ethers";
import React from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import withRoot from "../withRoot";
import Dashboard from "../components/Dashboard";
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
      ethProvider: new eth.providers.JsonRpcProvider(this.props.urls.eth),
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
      state.channelManager.address = config.contractAddress.toLowerCase();
      state.hubWallet.address = config.hubAddress.toLowerCase();
      return state;
    });
  }

  getWalletInfo = async address => {
    const { ethProvider } = this.state;
    this.setState({
      loadingWallet: true
    });
    const wei = await ethProvider.getBalance(address);
    console.log("wallet wei: ", wei);
    const tokenContract = new eth.Contract(
      this.state.tokenAddress,
      TokenAbi.abi,
      ethProvider,
    );
    const token = await tokenContract.balanceOf(address);
    console.log("wallet token: ", token);
    this.setState(state => {
      state.hubWallet.wei.raw = wei.toString();
      state.hubWallet.wei.formatted = eth.utils.formatEther(wei);
      state.hubWallet.token.raw = token.toString();
      state.hubWallet.token.formatted = eth.utils.formatEther(token);
      state.loadingWallet = false;
      return state;
    });
  };

  getContractInfo = async () => {
    const { ethProvider } = this.state;
    this.setState({
      loadingContract: true
    });
    console.log(
      "Investigating contract at:",
      this.state.channelManager.address
    );
    const cm = new eth.Contract(
      this.state.channelManager.address,
      ChannelManagerAbi.abi,
      ethProvider,
    );
    const wei = await cm.getHubReserveWei();
    console.log("contract wei: ", wei);
    const weiFormatted = eth.utils.formatEther(wei);
    console.log("contract wei formatted: ", weiFormatted);
    const token = await cm.getHubReserveTokens();
    console.log("contract token: ", token);
    const tokenFormatted = eth.utils.formatEther(token);
    console.log("contract token formatted: ", tokenFormatted);
    this.setState(state => {
      state.channelManager.wei.raw = wei.toString();
      state.channelManager.wei.formatted = weiFormatted;
      state.channelManager.token.raw = token.toString();
      state.channelManager.token.formatted = tokenFormatted;
      state.loadingContract = false;
      return state;
    });
  };

  render() {
    const { classes } = this.props;
    const { hubWallet, channelManager } = this.state;
    console.log(hubWallet);
    return (
      <div className={classes.root}>
        <Dashboard
          hubWallet={hubWallet}
          channelManager={channelManager}
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
