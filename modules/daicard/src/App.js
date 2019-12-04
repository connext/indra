import { Paper, withStyles, Grid } from "@material-ui/core";
import { useMachine } from "@xstate/react";
import { Contract, ethers as eth } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { fromExtendedKey, fromMnemonic } from "ethers/utils/hdnode";
import { formatEther, parseEther } from "ethers/utils";
import interval from "interval-promise";
import { PisaClient } from "pisa-client";
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import tokenArtifacts from "openzeppelin-solidity/build/contracts/ERC20Mintable.json";
import WalletConnectChannelProvider from "@walletconnect/channel-provider";
import * as connext from "@connext/client";

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
import { WithdrawSaiDialog } from "./components/withdrawSai";
import { rootMachine } from "./state";
import {
  cleanWalletConnect,
  Currency,
  migrate,
  minBN,
  storeFactory,
  tokenToWei,
  weiToToken,
  initWalletConnect,
} from "./utils";

const urls = {
  ethProviderUrl:
    process.env.REACT_APP_ETH_URL_OVERRIDE || `${window.location.origin}/api/ethprovider`,
  nodeUrl:
    process.env.REACT_APP_NODE_URL_OVERRIDE ||
    `${window.location.origin.replace(/^http/, "ws")}/api/messaging`,
  legacyUrl: chainId =>
    chainId.toString() === "1"
      ? "https://hub.connext.network/api/hub"
      : chainId.toString() === "4"
      ? "https://rinkeby.hub.connext.network/api/hub"
      : undefined,
  pisaUrl: chainId =>
    chainId.toString() === "1"
      ? "https://connext.pisa.watch"
      : chainId.toString() === "4"
      ? "https://connext-rinkeby.pisa.watch"
      : undefined,
};

// Constants for channel max/min - this is also enforced on the hub
const MAX_CHANNEL_VALUE = Currency.DAI("30");
const CF_PATH = "m/44'/60'/0'/25446";

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

function useWalletConnext() {
  const use = localStorage.getItem("useWalletConnext") === "true";
  const [walletConnext, setWalletConnext] = useState(use);

  function setWc(use) {
    if (useWalletConnext) {
      localStorage.setItem("useWalletConnext", true);
    } else {
      localStorage.setItem("useWalletConnext", false);
    }
    setWalletConnext(use);
  }

  return [walletConnext, setWc];
}

function parseQRCode(data) {
  // potential URLs to scan and their params
  const urls = {
    "/send?": ["recipient", "amount"],
    "/redeem?": ["secret", "amountToken"],
  };
  let args = {};
  let path = null;
  for (const [url, fields] of Object.entries(urls)) {
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
  return path;
}

const App = style(({ classes }) => {
  const defaultSwapRate = "100";
  const [balance, setBalance] = useState({
    channel: {
      ether: Currency.ETH("0", defaultSwapRate),
      token: Currency.DAI("0", defaultSwapRate),
      total: Currency.ETH("0", defaultSwapRate),
    },
    onChain: {
      ether: Currency.ETH("0", defaultSwapRate),
      token: Currency.DAI("0", defaultSwapRate),
      total: Currency.ETH("0", defaultSwapRate),
    },
  });
  const [machineState, machineAction] = useMachine(rootMachine);
  const [maxDeposit, setmaxDeposit] = useState();
  const [network, setNetwork] = useState();
  const [walletConnext, setWalletConnext] = useWalletConnext();
  const [saiBalance, setSaiBalance] = useState(Currency.DAI("0", defaultSwapRate));
  const [swapRate, setSwapRate] = useState(defaultSwapRate);
  const [token, setToken] = useState();
  const [tokenProfile, setTokenProfile] = useState();
  const [channel, setChannel] = useState();
  const [timeoutMs, setTimeoutMs] = useState(5 * 60 * 1000);

  const ethProvider = new eth.providers.JsonRpcProvider(urls.ethProviderUrl);

  const createWalletConnextChannel = async (chainId) => {
    let rpc = {};
    rpc[chainId] = urls.ethProviderUrl;
    const channelProvider = new WalletConnectChannelProvider({
      rpc,
      chainId,
    });
    console.log(
      `Using WalletConnect with provider: ${JSON.stringify(channelProvider, null, 2)}`,
    );
    // register channel provider listener for logging
    channelProvider.on("error", data => {
      console.error(`Channel provider error: ${JSON.stringify(data, null, 2)}`);
    });
    channelProvider.on("disconnect", (error, payload) => {
      if (error) {
        throw error;
      }
      cleanWalletConnect();
    });
    const channel = await connext.connect({
      ethProviderUrl: urls.ethProviderUrl,
      logLevel: 4,
      channelProvider,
    });
    return channel;
  }

  const createMnemonicChannel = async (chainId, wallet, mnemonic) => {
    let store;
    const pisaUrl = urls.pisaUrl(chainId);
    if (pisaUrl) {
      console.log(`Using external state backup service: ${pisaUrl}`);
      store = storeFactory({
        wallet,
        pisaClient: new PisaClient(
          pisaUrl,
          "0xa4121F89a36D1908F960C2c9F057150abDb5e1E3", // TODO: Don't hardcode
        ),
      });
    } else {
      store = storeFactory();
    }

    const hdNode = fromExtendedKey(fromMnemonic(mnemonic).extendedKey).derivePath(CF_PATH);
    const xpub = hdNode.neuter().extendedKey;
    const keyGen = index => {
      const res = hdNode.derivePath(index);
      return Promise.resolve(res.privateKey);
    };
    const channel = await connext.connect({
      ethProviderUrl: urls.ethProviderUrl,
      keyGen,
      logLevel: 5,
      nodeUrl: urls.nodeUrl,
      store,
      xpub,
    });
    console.log(`mnemonic address: ${wallet.address} (path: ${wallet.path})`);
    console.log(`xpub address: ${eth.utils.computeAddress(fromExtendedKey(xpub).publicKey)}`);
    console.log(
      `keygen address: ${new eth.Wallet(await keyGen("1")).address} (path ${
        new eth.Wallet(await keyGen("1")).path
      })`,
    );
    return channel;
  }

  useEffect(() => {
    async function init() {
      // If no mnemonic, create one and save to local storage
      let mnemonic = localStorage.getItem("mnemonic");
      console.log("walletConnext: ", walletConnext);
      if (!mnemonic) {
        mnemonic = eth.Wallet.createRandom().mnemonic;
        localStorage.setItem("mnemonic", mnemonic);
      }

      let wallet;
      await ethProvider.ready;
      const network = await ethProvider.getNetwork();
      setNetwork(network);
      if (!walletConnext) {
        wallet = eth.Wallet.fromMnemonic(mnemonic, CF_PATH + "/0").connect(ethProvider);
      }

      // migrate if needed
      if (wallet && localStorage.getItem("rpc-prod")) {
        machineAction(["MIGRATE", "START_MIGRATE"]);
        await migrate(urls.legacyUrl(network.chainId), wallet, urls.ethProviderUrl);
        localStorage.removeItem("rpc-prod");
      }

      machineAction("START");
      machineAction(["START", "START_START"]);

      let channel;
      if (walletConnext) {
        channel = await createWalletConnextChannel(network.chainId)
      } else {
        channel = await createMnemonicChannel(network.chainId, wallet, mnemonic);
      }
      setChannel(channel);
      console.log(`Successfully connected channel, waiting for availability`);
      await channel.isAvailable();
      console.log(`Channel is available`);

      const token = new Contract(
        channel.config.contractAddresses.Token,
        tokenArtifacts.abi,
        wallet || ethProvider,
      );
      setToken(token);
      setSwapRate(await channel.getLatestSwapRate(AddressZero, token.address));

      console.log(`Client created successfully!`);
      console.log(` - Public Identifier: ${channel.publicIdentifier}`);
      console.log(` - Account multisig address: ${channel.opts.multisigAddress}`);
      console.log(` - CF Account address: ${channel.signerAddress}`);
      console.log(` - Free balance address: ${channel.freeBalanceAddress}`);
      console.log(` - Token address: ${token.address}`);
      console.log(` - Swap rate: ${swapRate}`);

      channel.on("RECIEVE_TRANSFER_STARTED", data => {
        console.log("Received RECIEVE_TRANSFER_STARTED event: ", data);
        machineAction("START_RECEIVE");
      });

      channel.on("RECIEVE_TRANSFER_FINISHED", data => {
        console.log("Received RECIEVE_TRANSFER_FINISHED event: ", data);
        machineAction("SUCCESS_RECEIVE");
      });

      channel.on("RECIEVE_TRANSFER_FAILED", data => {
        console.log("Received RECIEVE_TRANSFER_FAILED event: ", data);
        machineAction("ERROR_RECEIVE");
      });

      const tokenProfile = await channel.addPaymentProfile({
        amountToCollateralize: DEFAULT_AMOUNT_TO_COLLATERALIZE.wad.toString(),
        minimumMaintainedCollateral: DEFAULT_COLLATERAL_MINIMUM.wad.toString(),
        assetId: token.address,
      });
      setTokenProfile(tokenProfile);
      console.log(`Set a default token profile: ${JSON.stringify(tokenProfile)}`);

      const saiBalance = Currency.DEI(await getSaiBalance(wallet || ethProvider), swapRate);
      if (saiBalance && saiBalance.wad.gt(0)) {
        setSaiBalance(saiBalance);
        machineAction("SAI");
      } else {
        machineAction("READY");
      }
      if (walletConnext) {
        const uri = localStorage.getItem(`wcUri`);
        if (!channel) return;
        if (!uri) return;
        initWalletConnect(uri, channel);
      }
      await startPoller();
    }
    init();
  }, []);

  const getSaiBalance = async wallet => {
    if (!channel.config.contractAddresses.SAIToken) {
      return Zero;
    }
    const saiToken = new Contract(
      channel.config.contractAddresses.SAIToken,
      tokenArtifacts.abi,
      wallet,
    );
    const freeSaiBalance = await channel.getFreeBalance(saiToken.address);
    const mySaiBalance = freeSaiBalance[channel.freeBalanceAddress];
    return mySaiBalance;
  };

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //

  // What's the minimum I need to be polling for here?
  //  - on-chain balance to see if we need to deposit
  //  - channel messages to see if there anything to sign
  //  - channel eth to see if I need to swap?
  const startPoller = async () => {
    await startDepositTimer();
    await refreshBalances();
    if (!walletConnext) {
      await autoSwap();
    } else {
      console.log("Using wallet connext, turning off autoswap");
    }
    interval(async () => {
      await refreshBalances();
      if (!walletConnext) {
        await autoSwap();
      }
    }, 3000);
  };

  // start the deposit timer
  const startDepositTimer = async () => {
    // use 5 min timer
    let timeoutMs;
    if (!timeoutMs || timeoutMs === 0) {
      timeoutMs = 5 * 60 * 1000;
    }
    if (!channel || !token) {
      return;
    }
    // claim deposit rights
    await channel.requestDepositRights({
      assetId: AddressZero,
      timeoutMs,
    });
    try {
      await channel.requestDepositRights({
        assetId: token.address,
        timeoutMs,
      });
    } catch (e) {
      if (e.message.includes(`Cannot claim deposit rights while hub is depositing`)) {
        setTimeoutMs(0);
        console.warn(`Cannot start deposit timer, hub is collateralizing us.`);
        return;
      }
    }

    setTimeoutMs(timeoutMs);
    setInterval(async () => {
      await tick();
    }, 1000);
  };

  const tick = async () => {
    if (!channel || !token) {
      return;
    }
    if (timeoutMs === 0) {
      return;
    }
    // set to 0 when no balance refund apps are installed

    // TODO: how to display if an eth balance refund but not a token
    // balance refund?
    const test = [
      await channel.getBalanceRefundApp(AddressZero),
      await channel.getBalanceRefundApp(token.address),
    ];
    const balanceRefundApps = test.filter(x => {
      return !!x && x.latestState["recipient"] === channel.freeBalanceAddress;
    });
    // set timer to 0 if any balance refund apps have
    // been uninstalled
    if (balanceRefundApps.length !== 2) {
      setTimeoutMs(0);
      return;
    }

    const timeout = timeoutMs - 1000;
    setTimeoutMs(timeout);
  };

  const refreshBalances = async () => {
    if (!channel || !swapRate) {
      return;
    }
    const { maxDeposit } = await getDepositLimits();
    setmaxDeposit(maxDeposit);
    const balance = await getChannelBalances();
    setBalance(balance);
  };

  const getDepositLimits = async () => {
    const maxDeposit = MAX_CHANNEL_VALUE.toETH(swapRate); // Or get based on payment profile?
    return { maxDeposit };
  };

  const getChannelBalances = async () => {
    const getTotal = (ether, token) => Currency.WEI(ether.wad.add(token.toETH().wad), swapRate);
    const freeEtherBalance = await channel.getFreeBalance();
    const freeTokenBalance = await channel.getFreeBalance(token.address);
    balance.onChain.ether = Currency.WEI(
      await ethProvider.getBalance(channel.multisigAddress),
      swapRate,
    ).toETH();
    balance.onChain.token = Currency.DEI(
      await token.balanceOf(channel.multisigAddress),
      swapRate,
    ).toDAI();
    balance.onChain.total = getTotal(balance.onChain.ether, balance.onChain.token).toETH();
    balance.channel.ether = Currency.WEI(
      freeEtherBalance[channel.freeBalanceAddress],
      swapRate,
    ).toETH();
    balance.channel.token = Currency.DEI(
      freeTokenBalance[channel.freeBalanceAddress],
      swapRate,
    ).toDAI();
    balance.channel.total = getTotal(balance.channel.ether, balance.channel.token).toETH();
    const logIfNotZero = (wad, prefix) => {
      if (wad.isZero()) {
        return;
      }
      console.debug(`${prefix}: ${wad.toString()}`);
    };
    logIfNotZero(balance.onChain.token.wad, `chain token balance`);
    logIfNotZero(balance.onChain.ether.wad, `chain ether balance`);
    logIfNotZero(balance.channel.token.wad, `channel token balance`);
    logIfNotZero(balance.channel.ether.wad, `channel ether balance`);
    return balance;
  };

  const autoSwap = async () => {
    if (!machineState.matches("ready")) {
      console.warn(`Channel not available yet.`);
      return;
    }
    if (
      // state.matches("ready.deposit.pending") ||
      machineState.matches("ready.swap.pending") ||
      machineState.matches("ready.withdraw.pending")
    ) {
      console.warn(`Another operation is pending, waiting to autoswap`);
      return;
    }
    if (balance.channel.ether.wad.eq(Zero)) {
      console.debug(`No in-channel eth available to swap`);
      return;
    }
    if (balance.channel.token.wad.gte(maxDeposit.toDAI(swapRate).wad)) {
      console.debug(`Swap ceiling has been reached, no need to swap more`);
      return;
    }

    const maxSwap = tokenToWei(maxDeposit.toDAI().wad.sub(balance.channel.token.wad), swapRate);
    const weiToSwap = minBN([balance.channel.ether.wad, maxSwap]);

    if (weiToSwap.isZero()) {
      // can happen if the balance.channel.ether.wad is 1 due to rounding
      console.debug(`Will not exchange 0 wei. This is still weird, so here are some logs:`);
      console.debug(`   - maxSwap: ${maxSwap.toString()}`);
      console.debug(`   - swapRate: ${swapRate.toString()}`);
      console.debug(`   - balance.channel.ether.wad: ${balance.channel.ether.wad.toString()}`);
      return;
    }

    const hubFBAddress = connext.utils.xpubToAddress(channel.nodePublicIdentifier);
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
      return;
    }
    console.log(`Attempting to swap ${formatEther(weiToSwap)} eth for dai at rate: ${swapRate}`);
    machineAction(["START_SWAP"]);

    await channel.swap({
      amount: weiToSwap.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: token.address,
    });
    await refreshBalances();
    machineAction(["SUCCESS_SWAP"]);
  };

  const depositAddress = channel ? channel.multisigAddress : AddressZero;

  return (
    <Router>
      <Grid className={classes.app}>
        <Paper elevation={1} className={classes.paper}>
          <AppBarComponent address={depositAddress} />

          <MySnackbar
            variant="warning"
            openWhen={machineState.matches("migrate.pending.show")}
            onClose={() => machineAction("DISMISS_MIGRATE")}
            message="Migrating legacy channel to 2.0..."
            duration={30 * 60 * 1000}
          />
          <MySnackbar
            variant="info"
            openWhen={machineState.matches("start.pending.show")}
            onClose={() => machineAction("DISMISS_START")}
            message="Starting Channel Controllers..."
            duration={30 * 60 * 1000}
          />
          {saiBalance.wad.gt(0) ? (
            <WithdrawSaiDialog
              channel={channel}
              ethProvider={ethProvider}
              machineState={machineState}
              machineAction={machineAction}
              saiBalance={saiBalance}
            />
          ) : (
            <></>
          )}

          <Route
            exact
            path="/"
            render={props => (
              <Grid>
                <Home
                  {...props}
                  startDepositTimer={startDepositTimer}
                  depositTimer={timeoutMs}
                  balance={balance}
                  swapRate={swapRate}
                  parseQRCode={parseQRCode}
                  channel={channel}
                />
                <SetupCard {...props} maxDeposit={maxDeposit} />
              </Grid>
            )}
          />
          <Route
            path="/deposit"
            render={props => (
              <DepositCard {...props} address={depositAddress} maxDeposit={maxDeposit} />
            )}
          />
          <Route
            path="/settings"
            render={props => (
              <SettingsCard
                {...props}
                setWalletConnext={setWalletConnext}
                getWalletConnext={walletConnext}
                store={channel ? channel.store : undefined}
                xpub={channel ? channel.publicIdentifier : "Unknown"}
              />
            )}
          />
          <Route
            path="/request"
            render={props => (
              <RequestCard
                {...props}
                xpub={channel ? channel.publicIdentifier : "Unknown"}
                maxDeposit={maxDeposit}
              />
            )}
          />
          <Route
            path="/send"
            render={props => (
              <SendCard
                {...props}
                balance={balance}
                channel={channel}
                ethProvider={ethProvider}
                token={token}
              />
            )}
          />
          <Route
            path="/redeem"
            render={props => (
              <RedeemCard {...props} channel={channel} tokenProfile={tokenProfile} />
            )}
          />
          <Route
            path="/cashout"
            render={props => (
              <CashoutCard
                {...props}
                balance={balance}
                channel={channel}
                ethProvider={ethProvider}
                swapRate={swapRate}
                machineAction={machineAction}
                network={network}
                refreshBalances={this.refreshBalances.bind(this)}
                token={token}
              />
            )}
          />
          <Route path="/support" render={props => <SupportCard {...props} channel={channel} />} />
          <Confirmations
            machineState={machineState}
            machineAction={machineAction}
            network={network}
          />
        </Paper>
      </Grid>
    </Router>
  );
});

export default App;
