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
import ReceiveCard from "./components/receiveCard";
import RedeemCard from "./components/redeemCard";
import SendCard from "./components/sendCard";
import SettingsCard from "./components/settingsCard";
import SetupCard from "./components/setupCard";
import SupportCard from "./components/supportCard";

import { Currency, getExchangeRates, toBN } from "./utils";

// Optional URL overrides for custom urls
const overrides = {
  wsUrl: process.env.REACT_APP_WS_OVERRIDE,
  ethUrl: process.env.REACT_APP_ETH_OVERRIDE,
};

// Constants for channel max/min - this is also enforced on the hub
const DEPOSIT_ESTIMATED_GAS = toBN("800000"); // 700k gas // TODO: estimate this dynamically
const HUB_EXCHANGE_CEILING = eth.constants.WeiPerEther.mul(toBN(69)); // 69 TST
const CHANNEL_DEPOSIT_MAX = eth.constants.WeiPerEther.mul(toBN(30)); // 30 TST

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
    this.state = {
      address: "",
      approvalWeiUser: "10000",
      balance: {
        channel: { token: "0", ether: "0" },
        onChain: { token: "0", ether: "0" },
      },
      authorized: "false",
      channelState: null,
      connext: null,
      connextState: null,
      contractAddress: null,
      ethprovider: null,
      exchangeRate: "0.00",
      hubUrl: null,
      hubWalletAddress: null,
      interval: null,
      loadingConnext: true,
      maxDeposit: null,
      minDeposit: null,
      modals: {
        cashOut: false,
        deposit: false,
        keyGen: false,
        receive: false,
        scan: false,
        send: false,
        settings: false,
      },
      pending: { deposit: false },
      publicUrl: window.location.origin.toLowerCase(),
      runtime: null,
      sendScanArgs: { amount: null, recipient: null },
      status: { txHash: "", type: "", reset: false },
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

    const wsUrl = overrides.wsUrl || `ws://localhost:4223`;
    const ethUrl = overrides.ethUrl || `${this.state.publicUrl}/api/ethprovider`;
    const ethprovider = new eth.providers.JsonRpcProvider(ethUrl)
    const wallet = eth.Wallet.fromMnemonic(mnemonic)

    const store = {
      get: (key) => {
        return localStorage.getItem(`CF_NODE:${key}`);
      },
      set: (pairs, allowDelete) => {
        for (const pair of pairs) {
          localStorage.setItem(`CF_NODE:${pair.key}`, pair.value);
        }
      }
    };

    const client = await connext.connect({ mnemonic, wsUrl, rpcProviderUrl: ethUrl, store });
    console.log("Client created successfully!");
    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    const connextConfig = await client.config();
    console.log("connextConfig:", connextConfig);

    this.setState({
      address: wallet.address,
      client,
      ethprovider,
      wallet,
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
    const { address, balance, client, ethprovider } = this.state;
    balance.onChain.ether = (await ethprovider.getBalance(address)).toString();
    balance.channel.ether = (await client.getChannel()).freeBalancePartyA.toString();
    // console.log(`balances: ${JSON.stringify(balance)}`)
    this.setState({ balance })
  }

  async setDepositLimits() {
    const { ethprovider } = this.state;
    let gasPrice = await ethprovider.getGasPrice()
    // default connext multiple is 1.5, leave 2x for safety
    let totalDepositGasWei = DEPOSIT_ESTIMATED_GAS.mul(toBN(2)).mul(gasPrice);
    const minDeposit = Currency.WEI(totalDepositGasWei, () => getExchangeRates());
    const maxDeposit = Currency.DEI(CHANNEL_DEPOSIT_MAX, () => getExchangeRates());
    this.setState({ maxDeposit, minDeposit });
  }

  async autoDeposit() {
    await this.setDepositLimits()
    const { balance, client, minDeposit, pending } = this.state;
    if (!client || pending.deposit) return;
    if (!(await client.getChannel()).available) {
      console.warn(`Channel not available yet.`);
      return;
    }

    const channel = await client.getChannel()
    console.log(`channel: ${JSON.stringify(channel, null, 2)}`);

    const bnBalance = {
      ether: toBN(balance.onChain.ether),
      token: toBN(balance.onChain.token),
    };

    if (
      bnBalance.ether.gt(eth.constants.Zero) ||
      bnBalance.token.gt(eth.constants.Zero)
    ) {
      const minWei = minDeposit.toWEI().floor()
      if (bnBalance.ether.lt(minWei)) {
        console.log(`Balance ${bnBalance} is below minimum ${minWei}`);
        return;
      }

      const depositParams = { amount: bnBalance.ether.sub(minWei).toString() };
      console.log(`Attempting to deposit ${depositParams.amount} wei...`);

      this.setState({ pending: { deposit: true } })
      await client.deposit(depositParams);
      this.setState({ pending: { deposit: false } })

      console.log(`Successfully deposited!`);
    }
  }

  async autoSwap() {
    const { balance } = this.state;
    const weiBalance = toBN(balance.channel.ether);
    const tokenBalance = toBN(balance.channel.token);
    if (weiBalance.gt(toBN("0")) && tokenBalance.lte(HUB_EXCHANGE_CEILING)) {
      await this.state.connext.exchange(weiBalance, "wei");
    }
  }

  async checkStatus() {
    const { runtime, status } = this.state;
    let log = () => {};
    let newStatus = {
      reset: status.reset
    };

    if (runtime) {
      log(`Hub Sync results: ${JSON.stringify(runtime.syncResultsFromHub[0], null, 2)}`);
      if (runtime.deposit.submitted) {
        if (!runtime.deposit.detected) {
          newStatus.type = "DEPOSIT_PENDING";
        } else {
          newStatus.type = "DEPOSIT_SUCCESS";
          newStatus.txHash = runtime.deposit.transactionHash;
        }
      }
      if (runtime.withdrawal.submitted) {
        if (!runtime.withdrawal.detected) {
          newStatus.type = "WITHDRAWAL_PENDING";
        } else {
          newStatus.type = "WITHDRAWAL_SUCCESS";
          newStatus.txHash = runtime.withdrawal.transactionHash;
        }
      }
    }

    if (newStatus.type !== status.type) {
      newStatus.reset = true;
      console.log(`New channel status! ${JSON.stringify(newStatus)}`);
    }

    this.setState({ status: newStatus });
  }

  closeConfirmations() {
    const { status } = this.state;
    this.setState({ status: { ...status, reset: false }})
  }

  // ************************************************* //
  //                    Handlers                       //
  // ************************************************* //

  updateApprovalHandler(evt) {
    this.setState({
      approvalWeiUser: evt.target.value
    });
  }

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
      channelState,
      sendScanArgs,
      exchangeRate,
      connext,
      connextState,
      runtime,
      maxDeposit,
      minDeposit,
      status
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
            <Confirmations status={status} closeConfirmations={this.closeConfirmations.bind(this)} />
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
                  exchangeRate={exchangeRate}
                  connextState={connextState}
                />
              )}
            />
            <Route
              path="/settings"
              render={props => (
                <SettingsCard
                  {...props}
                  connext={connext}
                  address={address}
                  exchangeRate={exchangeRate}
                  runtime={this.state.runtime}
                />
              )}
            />
            <Route
              path="/receive"
              render={props => (
                <ReceiveCard
                  {...props}
                  address={address}
                  connextState={connextState}
                  maxDeposit={maxDeposit}
                  channelState={channelState}
                  publicUrl={this.state.publicUrl}
                />
              )}
            />
            <Route
              path="/send"
              render={props => (
                <SendCard
                  {...props}
                  connext={connext}
                  address={address}
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
                  publicUrl={this.state.publicUrl}
                  connext={connext}
                  channelState={channelState}
                  connextState={connextState}
                />
              )}
            />
            <Route
              path="/cashout"
              render={props => (
                <CashOutCard
                  {...props}
                  address={address}
                  channelState={channelState}
                  publicUrl={this.state.publicUrl}
                  exchangeRate={exchangeRate}
                  connext={connext}
                  connextState={connextState}
                  runtime={runtime}
                />
              )}
            />
            <Route path="/support" render={props => <SupportCard {...props} channelState={channelState} />} />
          </Paper>
        </Grid>
      </Router>
    );
  }
}

export default withStyles(styles)(App);
