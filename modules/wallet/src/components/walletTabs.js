import React from "react";
import SwipeableViews from "react-swipeable-views";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import RefreshIcon from "@material-ui/icons/Refresh";
import { ethers } from "ethers";

function TabContainer({ children, dir }) {
  return (
    <Typography component="div" dir={dir} style={{ padding: 8 * 3 }}>
      {children}
    </Typography>
  );
}

class FullWidthTabs extends React.Component {
  state = {
    value: 0,
    metamask: {
      address: this.props.metamask.address,
      balance: this.props.metamask.balance,
      tokenBalance: this.props.metamask.tokenBalance
    },
    hubWallet: {
      address: this.props.hubWallet.address,
      balance: this.props.hubWallet.balance,
      tokenBalance: this.props.hubWallet.tokenBalance
    },
    channelManager: {
      address: this.props.channelManager.address,
      balance: this.props.channelManager.balance,
      tokenBalance: this.props.channelManager.tokenBalance
    },
    modalOpen: false,
    showWalletOptions: true
  };

  componentDidMount() {
    console.log('this.props.hubWallet: ', this.props.hubWallet);
  }

  async refreshBalances() {
    const { tokenContract, web3 } = this.props;
    const { hubWallet, channelManager } = this.state;
    console.log('hubWallet: ', hubWallet);

    const hubBalance = Number(await web3.eth.getBalance(hubWallet.address)) / 1000000000000000000;
    const hubTokenBalance = Number(await tokenContract.methods.balanceOf(hubWallet.address).call()) / 1000000000000000000;
    this.setState({
      hubWallet: {
        address: hubWallet.address,
        balance: hubBalance,
        tokenBalance: hubTokenBalance
      }
    });

    const cmBalance = Number(await web3.eth.getBalance(channelManager.address)) / 1000000000000000000;
    const cmTokenBalance = Number(await tokenContract.methods.balanceOf(this.state.channelManager.address).call()) / 1000000000000000000;
    this.setState({
      channelManager: {
        address: this.state.channelManager.address,
        balance: cmBalance,
        tokenBalance: cmTokenBalance
      }
    });

    if (!window.web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new ethers.providers.Web3Provider(window.web3);
    const metamask = metamaskProvider.getSigner();
    const address = (await metamask.provider.listAccounts())[0];
    if (!address) {
      this.setState({
        metamask: { address: "unavailable", balance: 0, tokenBalance: 0 }
      });
      return;
    }
    const mmBalance = Number(await web3.eth.getBalance(address)) / 1000000000000000000;
    const mmTokenBalance = Number(await tokenContract.methods.balanceOf(address).call()) / 1000000000000000000;
    this.setState({
      metamask: {
        address: address,
        balance: mmBalance,
        tokenBalance: mmTokenBalance
      }
    });
  }

  handleChange = (event, value) => {
    this.setState({ value });
    this.refreshBalances();
  };

  handleChangeIndex = index => {
    this.setState({ value: index });
  };

  render() {
    const tabStyles = {
      full: {
        width: "475px",
        alignItems: "center"
        // padding: "2% 2% 2% 2% "
      },
      bar: {},
      content: {
        backgroundColor: "#FFFFFF",
        boxShadow: "0px 1px 1px 1px #ADB5C1",
        borderRadius: "2px"
      },
      tabContainer: {
        maxWidth: "60%"
      },
      refresh: {
        float: "right",
        marginTop: "-45px"
      },
      bottomButtons: {
        display: "flex",
        justifyContent: "center"
      }
    };

    return (
      <div style={tabStyles.full}>
        <AppBar style={tabStyles.bar} position="static" color="default">
          <Tabs
            value={this.state.value}
            onChange={this.handleChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <Tab label="Metamask" />
            <Tab label="Hub" />
            <Tab label="Contract" />
          </Tabs>
        </AppBar>
        <br />
        <SwipeableViews style={tabStyles.content} axis={"rtl" ? "x-reverse" : "x"} index={this.state.value} onChangeIndex={this.handleChangeIndex}>
          <TabContainer style={tabStyles.tabContainer}>
            <div>
              <p>Address: {this.state.metamask.address}</p>
              <p>ETH Balance: {this.state.metamask.balance} </p>
              <p>TST Balance: {this.state.metamask.tokenBalance}</p>
            </div>
            <IconButton onClick={() => this.refreshBalances()} style={tabStyles.refresh}>
              <RefreshIcon />
            </IconButton>
          </TabContainer>
          <TabContainer style={tabStyles.tabContainer}>
            <div>
              <p>Address: {this.state.hubWallet.address}</p>
              <p>ETH Balance: {this.state.hubWallet.balance} </p>
              <p>TST Balance: {this.state.hubWallet.tokenBalance}</p>
            </div>
            <IconButton onClick={() => this.refreshBalances()} style={tabStyles.refresh}>
              <RefreshIcon />
            </IconButton>
          </TabContainer>
          <TabContainer style={tabStyles.tabContainer}>
            <div>
              <p>Address: {this.state.channelManager.address}</p>
              <p>ETH Balance: {this.state.channelManager.balance} </p>
              <p>TST Balance: {this.state.channelManager.tokenBalance}</p>
            </div>
            <IconButton onClick={() => this.refreshBalances()} style={tabStyles.refresh}>
              <RefreshIcon />
            </IconButton>
          </TabContainer>
        </SwipeableViews>
        <br />
      </div>
    );
  }
}

export default FullWidthTabs;
