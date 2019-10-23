import {
  Paper,
  withStyles,
  Grid,
} from "@material-ui/core";
import { Contract, ethers as eth } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { formatEther, parseEther } from "ethers/utils";
import interval from "interval-promise";
import { PisaClient } from "pisa-client";
import React from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import tokenArtifacts from "openzeppelin-solidity/build/contracts/ERC20Mintable.json";
import WalletConnectChannelProvider from "@walletconnect/channel-provider";
import * as connext from "@connext/client";
import { interpret } from 'xstate';

import "./App.css";

// Pages
import { AppBarComponent } from "./components/AppBar";
import { CashoutCard } from "./components/cashOutCard";
import { Confirmations } from "./components/Confirmations";
import { DepositCard } from "./components/depositCard";
import { Home } from "./components/Home";
import { MySnackbar } from "./components/snackBar";
import { RequestCard } from "./components/requestCard";
import { RedeemCard } from "./components/redeemCard";
import { SendCard } from "./components/sendCard";
import { SettingsCard } from "./components/settingsCard";
import { SetupCard } from "./components/setupCard";
import { SupportCard } from "./components/supportCard";
import { rootMachine } from "./state";
import {
  cleanWalletConnect,
  Currency,
  migrate,
  minBN,
  storeFactory,
  toBN,
  tokenToWei,
  weiToToken,
} from "./utils";

const urls = {
  ethProviderUrl: process.env.REACT_APP_ETH_URL_OVERRIDE || `${window.location.origin}/api/ethprovider`,
  nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE || `${window.location.origin.replace(/^http/, "ws")}/api/messaging`,
  legacyUrl: (chainId) =>
    chainId.toString() === "1" ? "https://hub.connext.network/api/hub" :
    chainId.toString() === "4" ? "https://rinkeby.hub.connext.network/api/hub" :
    undefined,
  pisaUrl: (chainId) =>
    chainId.toString() === "1" ? "https://connext.pisa.watch" :
    chainId.toString() === "4" ? "https://connext-rinkeby.pisa.watch" :
    undefined
}

// Constants for channel max/min - this is also enforced on the hub
const WITHDRAW_ESTIMATED_GAS = toBN("300000");
const DEPOSIT_ESTIMATED_GAS = toBN("25000");
const MAX_CHANNEL_VALUE = Currency.DAI("30");

// it is important to add a default payment
// profile on initial load in the case the
// user is being paid without depositing, or
// in the case where the user is redeeming a link

// NOTE: in the redeem controller, if the default payment is
// insufficient, then it will be updated. the same thing
// happens in autodeposit, if the eth deposited > deposit
// needed for autoswap
const DEFAULT_COLLATERAL_MINIMUM = Currency.DAI("5");
const DEFAULT_AMOUNT_TO_COLLATERALIZE = Currency.DAI("10");

const style = withStyles(theme => ({
  paper: {
    width: "100%",
    padding: `0px ${theme.spacing(1)}px 0 ${theme.spacing(1)}px`,
    [theme.breakpoints.up("sm")]: {
      width: "450px",
      height: "650px",
      marginTop: "5%",
      borderRadius: "4px",
    },
    [theme.breakpoints.down(600)]: {
      "box-shadow": "0px 0px",
    },
  },
  app: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    fontFamily: ["proxima-nova", "sans-serif"],
    backgroundColor: "#FFF",
    width: "100%",
    margin: "0px",
  },
  zIndex: 1000,
  grid: {},
}));

class App extends React.Component {
  constructor(props) {
    super(props);
    const swapRate = "100.00";
    this.state = {
      balance: {
        channel: {
          ether: Currency.ETH("0", swapRate),
          token: Currency.DAI("0", swapRate),
          total: Currency.ETH("0", swapRate),
        },
        onChain: {
          ether: Currency.ETH("0", swapRate),
          token: Currency.DAI("0", swapRate),
          total: Currency.ETH("0", swapRate),
        },
      },
      ethprovider: new eth.providers.JsonRpcProvider(urls.ethProviderUrl),
      machine: interpret(rootMachine),
      maxDeposit: null,
      minDeposit: null,
      network: {},
      useWalletConnext: false,
      sendScanArgs: { amount: null, recipient: null },
      redeemScanArgs: { amount: null, recipient: null },
      state: {},
      swapRate,
      token: null,
      tokenProfile: null,
    };
    this.refreshBalances.bind(this);
    this.autoDeposit.bind(this);
    this.autoSwap.bind(this);
    this.scanQRCode.bind(this);
    this.setWalletConnext.bind(this);
  }

  // ************************************************* //
  //                     Hooks                         //
  // ************************************************* //

  setWalletConnext = async (useWalletConnext) => {
    localStorage.setItem('useWalletConnext', useWalletConnext);
    this.setState({ useWalletConnext });
    window.location.reload();
  }

  // Channel doesn't get set up until after provider is set
  async componentDidMount() {
    // make sure starting from sq 1 with wallet connect
    cleanWalletConnect();
    const { ethprovider, machine } = this.state;
    machine.start();
    machine.onTransition(state => {
      this.setState({ state });
      console.log(`=== Transitioning to ${JSON.stringify(state.value)} (context: ${JSON.stringify(state.context)})`)
    });

    // If no mnemonic, create one and save to local storage
    let mnemonic = localStorage.getItem("mnemonic");
    const useWalletConnext = localStorage.getItem("useWalletConnext") || false;
    console.debug('useWalletConnext: ', useWalletConnext);
    if (!mnemonic && !useWalletConnext) {
      mnemonic = eth.Wallet.createRandom().mnemonic;
      localStorage.setItem("mnemonic", mnemonic);
    }

    let wallet;
    if (!useWalletConnext) {
      wallet = eth.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/25446").connect(ethprovider);
    };

    const network = await ethprovider.getNetwork();
    let channel;
    // migrate if needed
    if (localStorage.getItem("rpc-prod")) {
      machine.send(['MIGRATE', 'START_MIGRATE']);
      await migrate(urls.legacyUrl(network.chainId), wallet, urls.ethProviderUrl, machine);
      localStorage.removeItem("rpc-prod");
    }

    machine.send('START');
    machine.send(['START', 'START_START']);

    // if choose mnemonic
    if (!useWalletConnext) {
      // If no mnemonic, use the one we created pre-migration
      let store;
      if (urls.pisaUrl(network.chainId)) {
        store = storeFactory({
          wallet,
          pisaClient: new PisaClient(
            urls.pisaUrl(network.chainId),
            "0xa4121F89a36D1908F960C2c9F057150abDb5e1E3", // TODO: Don't hardcode
          ),
        });
      } else {
        store = storeFactory();
      }
      channel = await connext.connect({
        ethProviderUrl: urls.ethProviderUrl,
        logLevel: 5,
        mnemonic,
        nodeUrl: urls.nodeUrl,
        store,
      });
    } else if (useWalletConnext) {
      let channelProvider;
      let rpc = {};
      rpc[network.chainId] = urls.ethProviderUrl;
      channelProvider = new WalletConnectChannelProvider({
        rpc,
        chainId: network.chainId,
      });
      console.log("GOT CHANNEL PROVIDER:", JSON.stringify(channelProvider, null, 2));
      // register channel provider listener for logging
      channelProvider.on("error", (data) => {
        console.error(`Channel provider error: ${JSON.stringify(data, null, 2)}`);
      });
      channelProvider.on("disconnect", (error, payload) => {
        if (error) {
          throw error;
        }
        cleanWalletConnect();
      });
      channel = await connext.connect({
        ethProviderUrl: urls.ethProviderUrl,
        logLevel: 5,
        channelProvider,
      })
      console.log(`successfully connected channel`);
    } else {
      console.error("Could not create channel.");
      return;
    }

    // Wait for channel to be available
    const channelIsAvailable = async channel => {
      const chan = await channel.getChannel();
      return chan && chan.available;
    };

    while (!(await channelIsAvailable(channel))) {
      await new Promise(res => setTimeout(() => res(), 1000));
    }

    const token = new Contract(channel.config.contractAddresses.Token, tokenArtifacts.abi, wallet || ethprovider);
    const swapRate = await channel.getLatestSwapRate(AddressZero, token.address);

    try {
      await channel.getFreeBalance();
      await channel.getFreeBalance(token.address);
    } catch (e) {
      if (e.message.includes(`This probably means that the StateChannel does not exist yet`)) {
        // channel.connext was already called, meaning there should be
        // an existing channel
        await channel.restoreState(localStorage.getItem("mnemonic"))
        return
      }
      console.error(e)
      return;
    }

    console.log(`Client created successfully!`);
    console.log(` - Public Identifier: ${channel.publicIdentifier}`);
    console.log(` - Account multisig address: ${channel.opts.multisigAddress}`);
    console.log(` - CF Account address: ${channel.signerAddress}`);
    console.log(` - Free balance address: ${channel.freeBalanceAddress}`);
    console.log(` - Token address: ${token.address}`);
    console.log(` - Swap rate: ${swapRate}`);

    channel.subscribeToSwapRates(AddressZero, token.address, res => {
      if (!res || !res.swapRate) return;
      console.log(`Got swap rate upate: ${this.state.swapRate} -> ${res.swapRate}`);
      this.setState({ swapRate: res.swapRate });
    });

    channel.on("RECIEVE_TRANSFER_STARTED", data => {
      machine.send("START_RECEIVE");
    })

    channel.on("RECIEVE_TRANSFER_FINISHED", data => {
      console.log("Received RECIEVE_TRANSFER_FINISHED event: ", data);
      machine.send("SUCCESS_RECEIVE");
    })

    channel.on("RECIEVE_TRANSFER_FAILED", data => {
      console.log("Received RECIEVE_TRANSFER_FAILED event: ", data);
      machine.send("ERROR_RECEIVE");
    })

    const tokenProfile = await channel.addPaymentProfile({
      amountToCollateralize: DEFAULT_AMOUNT_TO_COLLATERALIZE.wad.toString(),
      minimumMaintainedCollateral: DEFAULT_COLLATERAL_MINIMUM.wad.toString(),
      assetId: token.address,
    });
    console.log(`Set a default token profile: ${JSON.stringify(tokenProfile)}`)
    machine.send('READY');

    this.setState({
      channel,
      useWalletConnext,
      ethprovider,
      network,
      swapRate,
      token,
      tokenProfile,
      wallet,
    });

    await this.startPoller();
  };

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //

  // What's the minimum I need to be polling for here?
  //  - on-chain balance to see if we need to deposit
  //  - channel messages to see if there anything to sign
  //  - channel eth to see if I need to swap?
  startPoller = async () => {
    const { useWalletConnext } = this.state;
    await this.refreshBalances();
    await this.setDepositLimits();
    if (!useWalletConnext) {
      await this.autoDeposit();
    } else {
      console.log("Using wallet connext, turning off autodeposit");
    }
    await this.autoSwap();
    interval(async (iteration, stop) => {
      await this.refreshBalances();
      await this.setDepositLimits();
      if (!useWalletConnext) {
        await this.autoDeposit();
      }
      await this.autoSwap();
    }, 3000);
  };

  refreshBalances = async () => {
    const { balance, channel, ethprovider, swapRate, token } = this.state;
    let gasPrice = await ethprovider.getGasPrice();
    let totalDepositGasWei = DEPOSIT_ESTIMATED_GAS.mul(toBN(2)).mul(gasPrice);
    let totalWithdrawalGasWei = WITHDRAW_ESTIMATED_GAS.mul(gasPrice);
    const minDeposit = Currency.WEI(
      totalDepositGasWei.add(totalWithdrawalGasWei),
      swapRate,
    ).toETH();
    const maxDeposit = MAX_CHANNEL_VALUE.toETH(swapRate); // Or get based on payment profile?
    this.setState({ maxDeposit, minDeposit });
    if (!channel || !swapRate) {
      return;
    }
    const getTotal = (ether, token) => Currency.WEI(ether.wad.add(token.toETH().wad), swapRate);
    const freeEtherBalance = await channel.getFreeBalance();
    const freeTokenBalance = await channel.getFreeBalance(token.address);
    balance.onChain.ether = Currency.WEI(await ethprovider.getBalance(channel.signerAddress), swapRate).toETH();
    balance.onChain.token = Currency.DEI(await token.balanceOf(channel.signerAddress), swapRate).toDAI();
    balance.onChain.total = getTotal(balance.onChain.ether, balance.onChain.token).toETH();
    balance.channel.ether = Currency.WEI(freeEtherBalance[channel.freeBalanceAddress], swapRate).toETH();
    balance.channel.token = Currency.DEI(freeTokenBalance[channel.freeBalanceAddress], swapRate).toDAI();
    balance.channel.total = getTotal(balance.channel.ether, balance.channel.token).toETH();
    const logIfNotZero = (wad, prefix) => {
      if (wad.isZero()) {
        return;
      }
      console.log(`${prefix}: ${wad.toString()}`)
    }
    logIfNotZero(balance.onChain.token.wad, `chain token balance`);
    logIfNotZero(balance.onChain.ether.wad, `chain ether balance`);
    logIfNotZero(balance.channel.token.wad, `channel token balance`);
    logIfNotZero(balance.channel.ether.wad, `channel ether balance`);
    this.setState({ balance });
  };

  setDepositLimits = async () => {
    const { swapRate, ethprovider } = this.state;
    let gasPrice = await ethprovider.getGasPrice();
    let totalDepositGasWei = DEPOSIT_ESTIMATED_GAS.mul(toBN(2)).mul(gasPrice);
    let totalWithdrawalGasWei = WITHDRAW_ESTIMATED_GAS.mul(gasPrice);
    const minDeposit = Currency.WEI(
      totalDepositGasWei.add(totalWithdrawalGasWei),
      swapRate,
    ).toETH();
    const maxDeposit = MAX_CHANNEL_VALUE.toETH(swapRate); // Or get based on payment profile?
    this.setState({ maxDeposit, minDeposit });
  };

  autoDeposit = async () => {
    const { balance, channel, machine, maxDeposit, minDeposit, state, swapRate, token } = this.state;
    if (!state.matches('ready')) {
      console.warn(`Channel not available yet.`);
      return;
    }
    if (state.matches('ready.deposit.pending') || state.matches('ready.swap.pending') || state.matches('ready.withdraw.pending')) {
      console.warn(`Another operation is pending, waiting to autoswap`);
      return;
    }
    if (balance.onChain.ether.wad.eq(Zero)) {
      console.debug(`No on-chain eth to deposit`)
      return;
    }

    let nowMaxDeposit = maxDeposit.wad.sub(this.state.balance.channel.total.wad);
    if (nowMaxDeposit.lte(Zero)) {
      console.debug(
        `Channel balance (${balance.channel.total.toDAI().format()}) is at or above ` +
          `cap of ${maxDeposit.toDAI(swapRate).format()}`,
      );
      return;
    }

    if (balance.onChain.token.wad.gt(Zero) || balance.onChain.ether.wad.gt(minDeposit.wad)) {
      machine.send(['START_DEPOSIT']);

      if (balance.onChain.token.wad.gt(Zero)) {
        const amount = minBN([
          Currency.WEI(nowMaxDeposit, swapRate).toDAI().wad,
          balance.onChain.token.wad
        ]);
        const depositParams = {
          amount: amount.toString(),
          assetId: token.address.toLowerCase(),
        };
        console.log(`Depositing ${depositParams.amount} tokens into channel: ${channel.opts.multisigAddress}`);
        const result = await channel.deposit(depositParams);
        await this.refreshBalances();
        console.log(`Successfully deposited tokens! Result: ${JSON.stringify(result, null, 2)}`);
      } else {
        console.debug(`No tokens to deposit`);
      }

      nowMaxDeposit = maxDeposit.wad.sub(this.state.balance.channel.total.wad);
      if (nowMaxDeposit.lte(Zero)) {
        console.debug(`Channel balance (${balance.channel.total.toDAI().format()}) is at or above ` +
          `cap of ${maxDeposit.toDAI(swapRate).format()}`)
        machine.send(['SUCCESS_DEPOSIT']);
        return;
      }
      if (balance.onChain.ether.wad.lt(minDeposit.wad)) {
        console.debug(`Not enough on-chain eth to deposit: ${balance.onChain.ether.toETH().format()}`)
        machine.send(['SUCCESS_DEPOSIT']);
        return;
      }

      const amount = minBN([
        balance.onChain.ether.wad.sub(minDeposit.wad),
        nowMaxDeposit,
      ]);
      console.log(`Depositing ${amount} wei into channel: ${channel.opts.multisigAddress}`);
      const result = await channel.deposit({ amount: amount.toString() });
      await this.refreshBalances();
      console.log(`Successfully deposited ether! Result: ${JSON.stringify(result, null, 2)}`);

      machine.send(['SUCCESS_DEPOSIT']);
      this.autoSwap();
    }
  }

  autoSwap = async () => {
    const { balance, channel, machine, maxDeposit, state, swapRate, token } = this.state;
    if (!state.matches('ready')) {
      console.warn(`Channel not available yet.`);
      return;
    }
    if (state.matches('ready.deposit.pending') || state.matches('ready.swap.pending') || state.matches('ready.withdraw.pending')) {
      console.warn(`Another operation is pending, waiting to autoswap`);
      return;
    }
    if (balance.channel.ether.wad.eq(Zero)) {
      console.debug(`No in-channel eth available to swap`);
      return;
    }
    if (balance.channel.token.wad.gte(maxDeposit.toDAI(swapRate).wad)) {
      return; // swap ceiling has been reached, no need to swap more
    }

    const maxSwap = tokenToWei(maxDeposit.toDAI().wad.sub(balance.channel.token.wad), swapRate);
    const weiToSwap = minBN([balance.channel.ether.wad, maxSwap]);

    console.log(`Attempting to swap ${formatEther(weiToSwap)} eth for dai at rate: ${swapRate}`);
    machine.send(['START_SWAP']);

    const hubFBAddress = connext.utils.freeBalanceAddressFromXpub(channel.nodePublicIdentifier);
    const collateralNeeded = balance.channel.token.wad.add(weiToToken(weiToSwap, swapRate));
    let collateral = formatEther((await channel.getFreeBalance(token.address))[hubFBAddress]);

    console.log(`Collateral: ${collateral} tokens, need: ${formatEther(collateralNeeded)}`);
    if (collateralNeeded.gt(parseEther(collateral))) {
      console.log(`Requesting more collateral...`);
      const tokenProfile = await channel.addPaymentProfile({
        amountToCollateralize: collateralNeeded.add(parseEther("10")), // add a buffer of $10 so you dont collateralize on every payment
        minimumMaintainedCollateral: collateralNeeded,
        assetId: token.address,
      });
      console.log(`Got a new token profile: ${JSON.stringify(tokenProfile)}`);
      this.setState({ tokenProfile });
      await channel.requestCollateral(token.address);
      collateral = formatEther((await channel.getFreeBalance(token.address))[hubFBAddress]);
      console.log(`Collateral: ${collateral} tokens, need: ${formatEther(collateralNeeded)}`);
    }
    await channel.swap({
      amount: weiToSwap.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: token.address,
    });
    await this.refreshBalances();
    machine.send(['SUCCESS_SWAP']);
  }

  // ************************************************* //
  //                    Handlers                       //
  // ************************************************* //

  scanQRCode = async data => {
    // potential URLs to scan and their params
    const urls = {
      "/send?": ["recipient", "amount"],
      "/redeem?": ["secret", "amountToken"],
    };
    let args = {};
    let path = null;
    for (let [url, fields] of Object.entries(urls)) {
      const strArr = data.split(url);
      if (strArr.length === 1) {
        // incorrect entry
        continue;
      }
      if (strArr[0] !== window.location.origin) {
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
          sendScanArgs: { ...args },
        });
        break;
      case "/redeem":
        this.setState({
          redeemScanArgs: { ...args },
        });
        break;
      default:
        break;
    }
    return path;
  };

  closeModal = async () => {
    this.setState({ loadingConnext: false });
  };

  render() {
    const {
      balance,
      channel,
      swapRate,
      machine,
      maxDeposit,
      minDeposit,
      network,
      sendScanArgs,
      token,
    } = this.state;
    const { classes } = this.props;
    return (
      <Router>
        <Grid className={classes.app}>
          <Paper elevation={1} className={classes.paper}>

            <AppBarComponent address={channel ? channel.signerAddress : AddressZero} />

            <MySnackbar
              variant="warning"
              openWhen={machine.state.matches('migrate.pending.show')}
              onClose={() => machine.send('DISMISS_MIGRATE')}
              message="Migrating legacy channel to 2.0..."
              duration={30 * 60 * 1000}
            />
            <MySnackbar
              variant="info"
              openWhen={machine.state.matches('start.pending.show')}
              onClose={() => machine.send('DISMISS_START')}
              message="Starting Channel Controllers..."
              duration={30 * 60 * 1000}
            />

            <Route
              exact
              path="/"
              render={props => (
                <Grid>
                  <Home
                    {...props}
                    balance={balance}
                    swapRate={swapRate}
                    scanQRCode={this.scanQRCode}
                    channel={channel}
                  />
                  <SetupCard
                    {...props}
                    minDeposit={minDeposit}
                    maxDeposit={maxDeposit}
                  />
                </Grid>
              )}
            />
            <Route
              path="/deposit"
              render={props => (
                <DepositCard
                  {...props}
                  address={channel ? channel.signerAddress : AddressZero}
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
                  channel={channel}
                  setWalletConnext={this.setWalletConnext}
                />
              )}
            />
            <Route
              path="/request"
              render={props => <RequestCard
                {...props}
                xpub={channel.publicIdentifier}
                maxDeposit={maxDeposit}
              />}
            />
            <Route
              path="/send"
              render={props => (
                <SendCard
                  {...props}
                  balance={balance}
                  channel={channel}
                  scanArgs={sendScanArgs}
                  token={token}
                />
              )}
            />
            <Route
              path="/redeem"
              render={props => (
                <RedeemCard {...props} channel={channel} tokenProfile={this.state.tokenProfile} />
              )}
            />
            <Route
              path="/cashout"
              render={props => (
                <CashoutCard
                  {...props}
                  balance={balance}
                  channel={channel}
                  swapRate={swapRate}
                  machine={machine}
                  refreshBalances={this.refreshBalances.bind(this)}
                  token={token}
                />
              )}
            />
            <Route path="/support" render={props => <SupportCard {...props} channel={channel} />} />
            <Confirmations
              machine={machine}
              network={network}
            />
          </Paper>
        </Grid>
      </Router>
    );
  }
}

export default style(App);
