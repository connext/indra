import { Paper, withStyles, Grid } from "@material-ui/core";
import * as connext from "@connext/client";
import { ethers as eth } from "ethers";
import interval from "interval-promise";
import React from "react";
import { BrowserRouter as Router, Route, Redirect } from "react-router-dom";

import "./App.css";

// Pages
import AppBarComponent from "./components/AppBar";
import CashOutCard from "./components/cashOutCard";
import Confirmations from "./components/Confirmations";
import DepositCard from "./components/depositCard";
import Home from "./components/Home";
import MySnackbar from "./components/snackBar";
import RequestCard from "./components/requestCard";
import RedeemCard from "./components/redeemCard";
import SendCard from "./components/sendCard";
import SettingsCard from "./components/settingsCard";
import SetupCard from "./components/setupCard";
import SupportCard from "./components/supportCard";

import { Currency, store, toBN } from "./utils";

// Optional URL overrides for custom urls
const overrides = {
  nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE,
  ethUrl: process.env.REACT_APP_ETH_URL_OVERRIDE,
};

// Constants for channel max/min - this is also enforced on the hub
const DEPOSIT_ESTIMATED_GAS = toBN("25000"); // TODO: estimate this dynamically
const HUB_EXCHANGE_CEILING = eth.utils.parseEther('69'); // 69 token
const CHANNEL_DEPOSIT_MAX = eth.utils.parseEther('30'); // 30 token

const styles = theme => ({
  paper: {
    width: "100%",
    padding: `0px ${theme.spacing(1)}px 0 ${theme.spacing(1)}px`,
    [theme.breakpoints.up("sm")]: {
      width: "450px",
      height: "650px",
      marginTop: "5%",
      borderRadius: "4px"
    },
    [theme.breakpoints.down(600)]: {
      "box-shadow": "0px 0px"
    }
  },
  app: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    fontFamily: ["proxima-nova", "sans-serif"],
    backgroundColor: "#FFF",
    width: "100%",
    margin: "0px"
  },
  zIndex: 1000,
  grid: {}
});

class App extends React.Component {
  constructor(props) {
    super(props);
    const daiRate = "314.08"
    this.state = {
      address: "",
      balance: {
        channel: { token: Currency.DEI("0", daiRate), ether: Currency.WEI("0", daiRate) },
        onChain: { token: Currency.DEI("0", daiRate), ether: Currency.WEI("0", daiRate) },
      },
      channelState: null,
      connextState: null,
      contractAddress: null,
      daiRate: daiRate,
      ethprovider: null,
      exchangeRate: "0.00",
      hubUrl: null,
      hubWalletAddress: null,
      interval: null,
      loadingConnext: true,
      maxDeposit: null,
      minDeposit: null,
      pending: { type: "", complete: false, closed: false },
      publicUrl: window.location.origin.toLowerCase(),
      runtime: null,
      sendScanArgs: { amount: null, recipient: null },
      tokenAddress: null,
      tokenContract: null,
    };
  }

  // ************************************************* //
  //                     Hooks                         //
  // ************************************************* //

  async componentDidMount() {
    // If no mnemonic, create one and save to local storage
    let mnemonic = localStorage.getItem("mnemonic");
    if (!mnemonic) {
      mnemonic = eth.Wallet.createRandom().mnemonic;
      localStorage.setItem("mnemonic", mnemonic);
    }

    const nodeUrl = overrides.nodeUrl || `${window.location.origin.replace(/^http/, 'ws')}/api/messaging`;
    const ethUrl = overrides.ethUrl || `${this.state.publicUrl}/api/ethprovider`;
    const ethprovider = new eth.providers.JsonRpcProvider(ethUrl)
    const cfPath = "m/44'/60'/0'/25446"
    const cfWallet = eth.Wallet.fromMnemonic(mnemonic, cfPath)

    const channel = await connext.connect({ mnemonic, nodeUrl, rpcProviderUrl: ethUrl, store });
    const freeBalanceAddress = channel.freeBalanceAddress || channel.myFreeBalanceAddress;

    console.log(`Client created successfully!`);
    console.log(`Public Identifier: ${channel.publicIdentifier}`);
    console.log(`Account multisig address: ${channel.opts.multisigAddress}`);
    console.log(`CF Account address: ${cfWallet.address}`)
    console.log(`Free balance address: ${freeBalanceAddress}`);

    const connextConfig = await channel.config();
    console.log(`connextConfig: ${JSON.stringify(connextConfig, null, 2)}`);

    this.setState({
      address: cfWallet.address,
      freeBalanceAddress,
      channel,
      ethprovider,
      wallet: cfWallet,
    });

    await this.startPoller();
    this.setState({ loadingConnext: false })
  }

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //

  async startPoller() {
    await this.refreshBalances();
    await this.setDepositLimits();
    await this.autoDeposit();
    await this.autoSwap();
    interval(async (iteration, stop) => {
      await this.refreshBalances();
      await this.setDepositLimits();
      await this.autoDeposit();
      await this.autoSwap();
    }, 2000);
  }

  async refreshBalances() {
    const { address, balance, channel, daiRate, ethprovider } = this.state;
    const freeBalance = await channel.getFreeBalance();
    balance.onChain.ether = Currency.WEI(await ethprovider.getBalance(address), daiRate);
    balance.channel.ether = Currency.WEI(freeBalance[this.state.freeBalanceAddress], daiRate);
    this.setState({ balance })
  }

  async setDepositLimits() {
    const { daiRate, ethprovider } = this.state;
    let gasPrice = await ethprovider.getGasPrice()
    // default multiple is 1.5, leave 2x for safety
    let totalDepositGasWei = DEPOSIT_ESTIMATED_GAS.mul(toBN(2)).mul(gasPrice);
    const minDeposit = Currency.WEI(totalDepositGasWei, daiRate);
    const maxDeposit = Currency.DEI(CHANNEL_DEPOSIT_MAX, daiRate);
    this.setState({ maxDeposit, minDeposit });
  }

  async autoDeposit() {
    const { balance, channel, minDeposit, maxDeposit, pending } = this.state;
    if (!channel || (pending.type === "deposit" && !pending.complete)) return;
    if (!(await channel.getChannel()).available) {
      console.warn(`Channel not available yet.`);
      return;
    }

    const bnBalance = {
      ether: toBN(balance.onChain.ether),
      token: toBN(balance.onChain.token),
    };

    const minWei = minDeposit.toWEI().floor()
    const maxWei = maxDeposit.toWEI().floor()

    if (
      bnBalance.ether.gt(minWei) ||
      bnBalance.token.gt(eth.constants.Zero)
    ) {
      if (bnBalance.ether.gt(maxWei)) {
        console.log(`Attempting to deposit more than the limit: ` +
          `${eth.utils.formatEther(bnBalance.ether)} > ${maxDeposit.toETH()}`);
        return;
      }

      const depositParams = { amount: bnBalance.ether.sub(minWei).toString() };

      const channelState = await channel.getChannel()
      console.log(`Attempting to deposit ${depositParams.amount} wei into channel: ${JSON.stringify(channelState, null, 2)}...`);

      this.setState({ pending: { type: "deposit", complete: false, closed: false  } })
      const result = await channel.deposit(depositParams);
      this.setState({ pending: { type: "deposit", complete: true, closed: false  } })

      console.log(`Successfully deposited! Result: ${JSON.stringify(result,null,2)}`);
    }
  }

  async autoSwap() {
    const { balance, channel } = this.state;
    const weiBalance = toBN(balance.channel.ether);
    const tokenBalance = toBN(balance.channel.token);
    if (false && weiBalance.gt(toBN("0")) && tokenBalance.lte(HUB_EXCHANGE_CEILING)) {
      await channel.exchange(weiBalance, "wei");
    }
  }

  closeConfirmations() {
    const { pending } = this.state;
    this.setState({ pending: { ...pending, closed: true }})
  }

  // ************************************************* //
  //                    Handlers                       //
  // ************************************************* //

  async scanQRCode(data) {
    // potential URLs to scan and their params
    const urls = {
      "/send?": ["recipient", "amount"],
      "/redeem?": ["secret", "amountToken"]
    };
    let args = {};
    let path = null;
    for (let [url, fields] of Object.entries(urls)) {
      const strArr = data.split(url);
      if (strArr.length === 1) {
        // incorrect entry
        continue;
      }
      if (strArr[0] !== this.state.publicUrl) {
        throw new Error("incorrect site");
      }
      // add the chosen url to the path scanned
      path = url + strArr[1];
      // get the args
      const params = strArr[1].split("&");
      fields.forEach((field, i) => {
        args[field] = params[i].split("=")[1];
      });
    }
    if (args === {}) {
      console.log("could not detect params");
    }
    switch (path) {
      case "/send":
        this.setState({
          sendScanArgs: { ...args }
        });
        break;
      case "/redeem":
        this.setState({
          redeemScanArgs: { ...args }
        });
        break;
      default:
        break;
    }
    return path;
  }

  async closeModal() {
    await this.setState({ loadingConnext: false });
  }

  render() {
    const {
      address,
      balance,
      channel,
      channelState,
      connextState,
      exchangeRate,
      maxDeposit,
      minDeposit,
      pending,
      runtime,
      sendScanArgs,
    } = this.state;
    const { classes } = this.props;
    return (
      <Router>
        <Grid className={classes.app}>
          <Paper elevation={1} className={classes.paper}>
            <MySnackbar
              variant="warning"
              openWhen={this.state.loadingConnext}
              onClose={() => this.closeModal()}
              message="Starting Channel Controllers.."
              duration={30000}
            />
            <AppBarComponent address={address} />
            <Route
              exact
              path="/"
              render={props =>
                runtime && runtime.channelStatus !== "CS_OPEN" ? (
                  <Redirect to="/support" />
                ) : (
                  <Grid>
                    <Home
                      {...props}
                      balance={balance}
                      scanQRCodee={this.scanQRCode.bind(this)}
                    />

                    <SetupCard
                      {...props}
                      minDeposit={minDeposit}
                      maxDeposit={maxDeposit}
                      connextState={connextState}
                    />
                  </Grid>
                )
              }
            />
            <Route
              path="/deposit"
              render={props => (
                <DepositCard
                  {...props}
                  address={address}
                  maxDeposit={maxDeposit}
                  minDeposit={minDeposit}
                />
              )}
            />
            <Route
              path="/settings"
              render={props => (
                <SettingsCard
                  {...props}
                />
              )}
            />
            <Route
              path="/request"
              render={props => (
                <RequestCard
                  {...props}
                  address={address}
                  maxDeposit={maxDeposit}
                />
              )}
            />
            <Route
              path="/send"
              render={props => (
                <SendCard
                  {...props}
                  address={address}
                  balance={balance}
                  channel={channel}
                  channelState={channelState}
                  publicUrl={this.state.publicUrl}
                  scanArgs={sendScanArgs}
                  connextState={connextState}
                />
              )}
            />
            <Route
              path="/redeem"
              render={props => (
                <RedeemCard
                  {...props}
                  balance={balance}
                  channelState={channelState}
                  channel={channel}
                  connextState={connextState}
                  publicUrl={this.state.publicUrl}
                />
              )}
            />
            <Route
              path="/cashout"
              render={props => (
                <CashOutCard
                  {...props}
                  address={address}
                  balance={balance}
                  channelState={channelState}
                  publicUrl={this.state.publicUrl}
                  exchangeRate={exchangeRate}
                  channel={channel}
                  connextState={connextState}
                  runtime={runtime}
                />
              )}
            />
            <Route path="/support" render={props => <SupportCard {...props} channelState={channelState} />} />
            <Confirmations pending={pending} closeConfirmations={this.closeConfirmations.bind(this)} />
          </Paper>
        </Grid>
      </Router>
    );
  }
}

export default withStyles(styles)(App);
