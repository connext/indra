import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import SwipeableViews from 'react-swipeable-views';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import RefreshIcon from '@material-ui/icons/Refresh';
const Web3 = require('web3');
const eth = require('ethers');

function TabContainer({ children, dir }) {
  return (
    <Typography component="div" dir={dir} style={{ padding: 8 * 3 }}>
      {children}
    </Typography>
  );
}

class FullWidthTabs extends React.Component {
    constructor(props) {
        super(props);
        }
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
        }
    };

    async refreshBalances() {
        const tokenContract = this.props.tokenContract
        const balance = Number(await this.props.web3.eth.getBalance(this.state.address)) / 1000000000000000000;
        const tokenBalance = Number(await tokenContract.methods.balanceOf(this.state.address).call()) / 1000000000000000000;
        this.setState({ balance: balance, tokenBalance: tokenBalance });

        const hubBalance = Number(await this.props.web3.eth.getBalance(this.state.hubWalletAddress)) / 1000000000000000000;
        const hubTokenBalance = Number(await this.props.tokenContract.methods.balanceOf(this.state.hubWalletAddress).call()) / 1000000000000000000;
        this.setState({
            hubWallet: {
                address: this.state.hubWalletAddress,
                balance: hubBalance,
                tokenBalance: hubTokenBalance
            }
        });

        const cmBalance = Number(await this.props.web3.eth.getBalance(this.state.channelManagerAddress)) / 1000000000000000000;
        const cmTokenBalance = Number(await tokenContract.methods.balanceOf(this.state.channelManagerAddress).call()) / 1000000000000000000;
        this.setState({
        channelManager: {
            address: this.state.channelManagerAddress,
            balance: cmBalance,
            tokenBalance: cmTokenBalance
        }
        });

        let web3 = window.web3;
        if (!web3) {
        alert("You need to install & unlock metamask to do that");
        return;
        }
        const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
        const metamask = metamaskProvider.getSigner();
        const address = (await metamask.provider.listAccounts())[0];
        if (!address) {
        this.setState({ metamask: { address: "unavailable", balance: 0, tokenBalance: 0 } });
        return;
        }
        const mmBalance = Number(await this.props.web3.eth.getBalance(address)) / 1000000000000000000;
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
  };

  handleChangeIndex = index => {
    this.setState({ value: index });
  };

  render() {

    const tabStyles = {
      full:{
        width:'60%',
        alignItems:'center'
      },
      bar:{
        maxWidth:'100%',
      },
      content:{
          backgroundColor:"#EAEBEE",
          boxShadow:'0px 1px 1px 1px #ADB5C1',
          borderRadius: '2px'
      }
    }

    return (
      <div style={tabStyles.full}>
        <AppBar style={tabStyles.bar} position="static" color="default">
          <Tabs
            value={this.state.value}
            onChange={this.handleChange}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Metamask" />
            <Tab label="Hub" />
            <Tab label="Contract" />
          </Tabs>
        </AppBar>
        <br />
        <SwipeableViews
          style={tabStyles.content}
          axis={'rtl' ? 'x-reverse' : 'x'}
          index={this.state.value}
          onChangeIndex={this.handleChangeIndex}
        >
          <TabContainer >
            <div>
                <p>Address: {this.state.metamask.address}</p>
                <p>ETH Balance: {this.state.metamask.balance} </p>
                <p>TST Balance: {this.state.metamask.tokenBalance}</p>
            </div>
          </TabContainer>
          <TabContainer>
            <div>
                <p>Address: {this.state.hubWallet.address}</p>
                <p>ETH Balance: {this.state.hubWallet.balance} </p>
                <p>TST Balance: {this.state.hubWallet.tokenBalance}</p>
            </div>
          </TabContainer>
          <TabContainer >
          <div>
                <p>Address: {this.state.channelManager.address}</p>
                <p>ETH Balance: {this.state.channelManager.balance} </p>
                <p>TST Balance: {this.state.channelManager.tokenBalance}</p>
        </div>
          </TabContainer>
          <IconButton
            onClick={() => this.refreshBalances()}
            >
            <RefreshIcon/>
          </IconButton>
        </SwipeableViews>
      </div>
    );
  }
}


export default FullWidthTabs;
