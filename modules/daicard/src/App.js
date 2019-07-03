import { Paper, withStyles, Grid } from "@material-ui/core";
import * as connext from "@connext/client";
import { ethers as eth } from "ethers";
import interval from "interval-promise";
import React from "react";
import { BrowserRouter as Router, Route, Redirect } from "react-router-dom";

import "./App.css";

// Pages
import Home from "./components/Home";
import DepositCard from "./components/depositCard";
import AppBarComponent from "./components/AppBar";
import SettingsCard from "./components/settingsCard";
import ReceiveCard from "./components/receiveCard";
import SendCard from "./components/sendCard";
import CashOutCard from "./components/cashOutCard";
import SupportCard from "./components/supportCard";
import RedeemCard from "./components/redeemCard";
import SetupCard from "./components/setupCard";
import Confirmations from "./components/Confirmations";
import MySnackbar from "./components/snackBar";

import { Currency, getExchangeRates, toBN } from "./utils";

let publicUrl;

// Optional URL overrides for custom urls
const overrides = {
  hubUrl: process.env.REACT_APP_HUB_OVERRIDE,
  natsUrl: process.env.REACT_APP_NATS_OVERRIDE,
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
      loadingConnext: true,
      hubUrl: null,
      tokenAddress: null,
      contractAddress: null,
      hubWalletAddress: null,
      ethprovider: null,
      tokenContract: null,
      connext: null,
      modals: {
        settings: false,
        keyGen: false,
        receive: false,
        send: false,
        cashOut: false,
        scan: false,
        deposit: false
      },
      authorized: "false",
      approvalWeiUser: "10000",
      channelState: null,
      exchangeRate: "0.00",
      interval: null,
      connextState: null,
      runtime: null,
      sendScanArgs: {
        amount: null,
        recipient: null
      },
      address: "",
      status: {
        txHash: "",
        type: "",
        reset: false
      },
      minDeposit: null,
      maxDeposit: null,
    };
  }

  // ************************************************* //
  //                     Hooks                         //
  // ************************************************* //

  async componentDidMount() {
    // on mount, check if you need to refund by removing maxBalance
    localStorage.removeItem("refunding");

    // set public url
    publicUrl = window.location.origin.toLowerCase();

    // Get mnemonic and rpc type
    let mnemonic = localStorage.getItem("mnemonic");

    // If no mnemonic, create one and save to local storage
    if (!mnemonic) {
      mnemonic = eth.Wallet.createRandom().mnemonic;
      localStorage.setItem("mnemonic", mnemonic);
    }

    const wsUrl = overrides.natsUrl || `ws://localhost:4223`;
    // const nodeUrl = overrides.nodeUrl || `http://localhost:8080`;
    const ethUrl = overrides.ethUrl || `${publicUrl}/api/ethprovider`;
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

    const opts = { mnemonic, wsUrl, rpcProviderUrl: ethUrl, store };

    console.log("Using client options:");
    console.log("  - mnemonic:", opts.mnemonic);
    console.log("  - wsUrl:", opts.wsUrl);
    console.log("  - rpcProviderUrl:", opts.rpcProviderUrl);

    console.log("Creating connext");
    const client = await connext.connect(opts);
    console.log("Client created successfully!");
    const connextConfig = await client.config();

    console.log("connextConfig:", connextConfig);
    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    this.setState({
      address: wallet.address,
      ethChainId: (await ethprovider.getNetwork()).chainId,
      ethprovider,
      wallet,
    });

    await this.setDepositLimits();
    await this.poller();

    this.setState({ loadingConnext: false })
  }

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //

  async poller() {
    await this.autoDeposit();
    await this.autoSwap();

    interval(async (iteration, stop) => {
      await this.autoDeposit();
    }, 5000);

    interval(async (iteration, stop) => {
      await this.autoSwap();
    }, 1000);
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
    const { address, tokenContract, connextState, tokenAddress, connext, minDeposit, ethprovider } = this.state;
    const gasPrice = (await ethprovider.getGasPrice()).toHexString()
    if (!connext || !minDeposit) return;

    const balance = await ethprovider.getBalance(address);

    let tokenBalance = "0";
    try {
      tokenBalance = await tokenContract.balanceOf(address);
    } catch (e) {
      console.warn(
        `Error fetching token balance, are you sure the token address (addr: ${tokenAddress}) is correct for the selected network (id: ${JSON.stringify(
          await ethprovider.getNetwork()
        )}))? Error: ${e.message}`
      );
      return;
    }

    if (balance.gt(eth.constants.Zero) || tokenBalance.gt(eth.constants.Zero)) {
      const minWei = minDeposit.toWEI().floor()
      if (balance.lt(minWei)) {
        // don't autodeposit anything under the threshold
        // update the refunding variable before returning
        // We hit this repeatedly after first deposit & we have dust left over
        // No need to clutter logs w the below
        // console.log(`Current balance is ${balance.toString()}, less than minBalance of ${minWei.toString()}`);
        return;
      }
      // only proceed with deposit request if you can deposit
      if (!connextState) {
        return;
      }
      if (
        // something was submitted
        connextState.runtime.deposit.submitted ||
        connextState.runtime.withdrawal.submitted ||
        connextState.runtime.collateral.submitted
      ) {
        console.log(`Deposit or withdrawal transaction in progress, will not auto-deposit`);
        return;
      }

      let channelDeposit = {
        amountWei: balance.sub(minWei),
        amountToken: tokenBalance
      };

      if (channelDeposit.amountWei.eq(eth.constants.Zero) && channelDeposit.amountToken.eq(eth.constants.Zero)) {
        return;
      }

      console.log(`Depositing with gas price of ${eth.utils.formatUnits(toBN(gasPrice), 'gwei')} gwei`);

      await this.state.connext.deposit({ 
        amountWei: channelDeposit.amountWei.toString(), 
        amountToken: channelDeposit.amountToken.toString() 
      }, { gasPrice });
    }
  }

  async autoSwap() {
    const { channelState, connextState } = this.state;
    if (!connextState) {
      return;
    }
    const weiBalance = toBN(channelState.balanceWeiUser);
    const tokenBalance = toBN(channelState.balanceTokenUser);
    if (channelState && weiBalance.gt(toBN("0")) && tokenBalance.lte(HUB_EXCHANGE_CEILING)) {
      await this.state.connext.exchange(channelState.balanceWeiUser, "wei");
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

  async scanURL(path, args) {
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
        return;
    }
  }

  async closeModal() {
    await this.setState({ loadingConnext: false });
  }

  render() {
    const {
      address,
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
                      address={address}
                      connextState={connextState}
                      channelState={channelState}
                      publicUrl={publicUrl}
                      scanURL={this.scanURL.bind(this)}
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
                  publicUrl={publicUrl}
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
                  publicUrl={publicUrl}
                  scanArgs={sendScanArgs}
                  connextState={connextState}
                />
              )}
            />
            <Route
              path="/redeem"
              render={props => (
                <RedeemCard {...props} publicUrl={publicUrl} connext={connext} channelState={channelState} connextState={connextState} />
              )}
            />
            <Route
              path="/cashout"
              render={props => (
                <CashOutCard
                  {...props}
                  address={address}
                  channelState={channelState}
                  publicUrl={publicUrl}
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
