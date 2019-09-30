import { Paper, withStyles, Grid } from "@material-ui/core";
import * as connext from "@connext/client";
import { Contract, ethers as eth } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { formatEther, parseEther } from "ethers/utils";
import interval from "interval-promise";
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import tokenArtifacts from "openzeppelin-solidity/build/contracts/ERC20Mintable.json";

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

import { Currency, store, minBN, toBN, tokenToWei, weiToToken } from "./utils";

// Optional URL overrides for custom urls
const overrides = {
  nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE,
  ethProviderUrl: process.env.REACT_APP_ETH_URL_OVERRIDE,
};

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

const style = withStyles((theme) => ({
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

const zeroBalance = {
  channel: { ether: Currency.ETH("0"), token: Currency.DAI("0"), total: Currency.ETH("0") },
  onChain: { ether: Currency.ETH("0"), token: Currency.DAI("0"), total: Currency.ETH("0") },
}

export const App = style(({ classes }) => {
  const [swapRate, setSwapRate] = useState('1');
  const [balance, setBalance] = useState(zeroBalance);
  const [channel, setChannel] = useState(null);
  const [loadingConnext, setLoadingConnext] = useState(true);
  const [maxDeposit, setMaxDeposit] = useState(null);
  const [minDeposit, setMinDeposit] = useState(Currency.DAI("0", swapRate));
  const [pending, setPending] = useState({ type: "", complete: true, closed: true });
  const [sendScanArgs, setSendScanArgs] = useState({ amount: null, recipient: null });
  const [redeemScanArgs, setRedeemScanArgs] = useState({ amount: null, recipient: null });
  const [token, setToken] = useState(null);
  const [tokenProfile, setTokenProfile] = useState(null);
  const [wallet, setWallet] = useState({});

  ////////////////////////////////////////
  // Init some misc variables

  // ************************************************* //
  //                     Hooks                         //
  // ************************************************* //

  useEffect(() => {

    // If no mnemonic, create one and save to local storage
    let mnemonic = localStorage.getItem("mnemonic");
    if (!mnemonic) {
      mnemonic = eth.Wallet.createRandom().mnemonic;
      localStorage.setItem("mnemonic", mnemonic);
    }

    const nodeUrl =
      overrides.nodeUrl || `${window.location.origin.replace(/^http/, "ws")}/api/messaging`;
    const ethProviderUrl = overrides.ethProviderUrl || `${window.location.origin}/api/ethprovider`;
    const ethProvider = new eth.providers.JsonRpcProvider(ethProviderUrl);
    const cfPath = "m/44'/60'/0'/25446";
    const cfWallet = eth.Wallet.fromMnemonic(mnemonic, cfPath).connect(ethProvider);

    (async () => {

      const channel = await connext.connect({
        ethProviderUrl,
        logLevel: 5,
        mnemonic,
        nodeUrl,
        store,
      });

      // Wait for channel to be available
      const channelIsAvailable = async (channel) => {
        const chan = await channel.getChannel()
        return chan && chan.available
      }
      while (!(await channelIsAvailable(channel))) {
        await new Promise(res => setTimeout(() => res(), 1000));
      }

      const token = new Contract(channel.config.contractAddresses.Token, tokenArtifacts.abi, cfWallet);
      const currentSwapRate = await channel.getLatestSwapRate(AddressZero, token.address)

      console.log(`Client created successfully!`);
      console.log(` - Account multisig address: ${channel.opts.multisigAddress}`);
      console.log(` - Free balance address: ${channel.freeBalanceAddress}`);
      console.log(` - Token address: ${channel.config.contractAddresses.Token}`);
      console.log(` - Swap rate: ${currentSwapRate}`)

      channel.subscribeToSwapRates(AddressZero, token.address, (res) => {
        if (!res || !res.swapRate) return;
        console.log(`Got swap rate upate: ${currentSwapRate} -> ${res.swapRate}`);
        setSwapRate(res.swapRate)
      })

      const tokenProfile = await channel.addPaymentProfile({
        amountToCollateralize: DEFAULT_AMOUNT_TO_COLLATERALIZE.wad.toString(),
        minimumMaintainedCollateral: DEFAULT_COLLATERAL_MINIMUM.wad.toString(),
        assetId: channel.config.contractAddresses.Token,
      });

      setChannel(channel)
      setSwapRate(currentSwapRate)
      setToken(token)
      setTokenProfile(tokenProfile);
      setWallet(cfWallet)
      setLoadingConnext(false)

    })()
  }, [])

  // ************************************************* //
  //                 Core Poller                       //
  // ************************************************* //

  useEffect(() => {
    // Wait until channel is set up before this effect should be applied
    if (loadingConnext) { return; }
    console.log(`Starting core poller effect | loading ${loadingConnext} | channel ${channel} | swapRate ${swapRate}`)

    // setState functions apply between renders but autoDeposit runs right after refreshBalances
    // regardless of render status. Keep a local copy of these vars so that status updates eg
    // made by refreshBalances are available in autoDeposit
    let balance = zeroBalance
    let minDeposit
    let maxDeposit
    let pending = { type: "", complete: true, closed: true }

    const refreshBalances = async () => {
      const getTotal = (etherAmt, tokenAmt) => Currency.WEI(etherAmt.wad.add(tokenAmt.toETH(swapRate).wad));
      const freeEtherBalance = await channel.getFreeBalance();
      const freeTokenBalance = await channel.getFreeBalance(token.address);
      balance.onChain.ether = Currency.WEI(await wallet.provider.getBalance(wallet.address)).toETH(swapRate);
      balance.onChain.token = Currency.DEI(await token.balanceOf(wallet.address)).toDAI(swapRate);
      balance.onChain.total = getTotal(balance.onChain.ether, balance.onChain.token).toETH(swapRate);
      balance.channel.ether = Currency.WEI(freeEtherBalance[channel.freeBalanceAddress]).toETH(swapRate);
      balance.channel.token = Currency.DEI(freeTokenBalance[channel.freeBalanceAddress]).toDAI(swapRate);
      balance.channel.total = getTotal(balance.channel.ether, balance.channel.token).toETH(swapRate);
      setBalance(balance);
      const gasPrice = await wallet.provider.getGasPrice();
      const totalDepositGasWei = DEPOSIT_ESTIMATED_GAS.mul(toBN(2)).mul(gasPrice);
      const totalWithdrawalGasWei = WITHDRAW_ESTIMATED_GAS.mul(gasPrice);
      minDeposit = Currency.WEI(totalDepositGasWei.add(totalWithdrawalGasWei)).toETH(swapRate);
      maxDeposit = MAX_CHANNEL_VALUE.toETH(swapRate); // Or get based on payment profile?
      console.log(`Setting`)
      setMaxDeposit(maxDeposit)
      setMinDeposit(minDeposit)
    }

    const autoDeposit = async () => {
      console.log(`AutoDeposit | swapRate ${swapRate} | balance ${JSON.stringify(
        balance,
        (key, value) => (typeof value.format === 'function') ? value.format() : value,
        2
      )}`);
      if (!channel || !token || !swapRate || !maxDeposit || !minDeposit) {
        console.log(`Aborting autoDeposit, stuff missing`)
        console.log(`channel ${channel} | token ${token} | swapRate ${swapRate} | maxDeposit ${maxDeposit} | minDeposit ${minDeposit}`)
        return;
      }
      console.log(`Autodeposit ready to proceed!`)
      if (balance.onChain.ether.wad.eq(Zero)) {
        console.debug(`No on-chain eth to deposit`)
        return;
      }
      if (!pending.complete) {
        console.log(`An operation of type ${pending.type} is pending, waiting to deposit`)
        return;
      }
      let nowMaxDeposit = maxDeposit.wad.sub(balance.channel.total.wad);
      if (nowMaxDeposit.lte(Zero)) {
        console.debug(`Channel balance (${balance.channel.total.toDAI(swapRate).format()}) is at or above ` +
          `cap of ${maxDeposit.toDAI(swapRate).format()}`)
        return;
      }
      if (balance.onChain.token.wad.gt(Zero)) {
        setPending({ type: "deposit", complete: false, closed: false });
        const amount = minBN([
          Currency.WEI(nowMaxDeposit).toDAI(swapRate).wad,
          balance.onChain.token.wad
        ]);
        const depositParams = {
          amount: amount.toString(),
          assetId: token.address.toLowerCase(),
        };
        console.log(`Depositing ${depositParams.amount} tokens into channel: ${channel.opts.multisigAddress}`);
        const result = await channel.deposit(depositParams);
        await refreshBalances();
        console.log(`Successfully deposited tokens! Result: ${JSON.stringify(result, null, 2)}`);
        setPending({ type: "deposit", complete: true, closed: false });
      } else {
        console.debug(`No tokens to deposit`);
      }
      nowMaxDeposit = maxDeposit.wad.sub(balance.channel.total.wad);
      if (nowMaxDeposit.lte(Zero)) {
        console.debug(`Channel balance (${balance.channel.total.toDAI(swapRate).format()}) is at or above ` +
          `cap of ${maxDeposit.toDAI(swapRate).format()}`)
        return;
      }
      if (balance.onChain.ether.wad.lt(minDeposit.wad)) {
        console.debug(`Not enough on-chain eth to deposit: ${balance.onChain.ether.toETH().format()}`)
        return;
      }
      setPending({ type: "deposit", complete: false, closed: false });
      const amount = minBN([
        balance.onChain.ether.wad.sub(minDeposit.wad),
        nowMaxDeposit,
      ]);
      console.log(`Depositing ${amount} wei into channel: ${channel.opts.multisigAddress}`);
      const result = await channel.deposit({ amount: amount.toString() });
      await refreshBalances();
      console.log(`Successfully deposited ether! Result: ${JSON.stringify(result, null, 2)}`);
      setPending({ type: "deposit", complete: true, closed: false });
      autoSwap();
    }

    const autoSwap = async () => {
      if (!channel || !token || !swapRate || !maxDeposit || !minDeposit) { return; }
      if (balance.channel.ether.wad.eq(Zero)) {
        console.debug(`No in-channel eth available to swap`)
        return;
      }
      if (balance.channel.token.wad.gte(maxDeposit.toDAI(swapRate).wad)) {
        return; // swap ceiling has been reached, no need to swap more
      }
      if (!pending.complete) {
        console.log(`An operation of type ${pending.type} is pending, waiting to swap`)
        return;
      }
      const maxSwap = tokenToWei(maxDeposit.toDAI(swapRate).wad.sub(balance.channel.token.wad), swapRate)
      const weiToSwap = minBN([balance.channel.ether.wad, maxSwap])
      console.log(`Attempting to swap ${formatEther(weiToSwap)} eth for dai at rate: ${swapRate}`);
      setPending({ type: "swap", complete: false, closed: false });
      const hubFBAddress = connext.utils.freeBalanceAddressFromXpub(channel.nodePublicIdentifier)
      const collateralNeeded = balance.channel.token.wad.add(weiToToken(weiToSwap, swapRate));
      let collateral = formatEther((await channel.getFreeBalance(token.address))[hubFBAddress])
      console.log(`Collateral: ${collateral} tokens, need: ${formatEther(collateralNeeded)}`);
      if (collateralNeeded.gt(parseEther(collateral))) {
        console.log(`Requesting more collateral...`)
        const tokenProfile = await channel.addPaymentProfile({
          amountToCollateralize: collateralNeeded.add(parseEther("10")), // add a buffer of $10 so you dont collateralize on every payment
          minimumMaintainedCollateral: collateralNeeded,
          assetId: token.address,
        });
        console.log(`Got a new token profile: ${JSON.stringify(tokenProfile)}`)
        setTokenProfile(tokenProfile);
        await channel.requestCollateral(token.address);
        collateral = formatEther((await channel.getFreeBalance(token.address))[hubFBAddress])
        console.log(`Collateral: ${collateral} tokens, need: ${formatEther(collateralNeeded)}`);
      }
      console.log(`Executing channel.swap ${JSON.stringify({
        amount: weiToSwap.toString(),
        fromAssetId: AddressZero,
        swapRate,
        toAssetId: token.address,
      })}`);
      await channel.swap({
        amount: weiToSwap.toString(),
        fromAssetId: AddressZero,
        swapRate,
        toAssetId: token.address,
      });
      await refreshBalances();
      setPending({ type: "swap", complete: true, closed: false });
    }

    (async () => {
      await refreshBalances();
      await autoDeposit();
      await autoSwap();
      // What's the minimum we need to be polling for here?
      //  - on-chain balance to see if we need to deposit
      //  - channel messages to see if there anything to sign
      //  - channel eth to see if I need to swap?
      let shouldStop = false;
      interval(async (iteration, stop) => {
        if (shouldStop) { return stop(); }
        console.log(`Polling | swapRate ${swapRate} | balance ${JSON.stringify(
          balance,
          (key, value) => (typeof value.format === 'function') ? value.format() : value,
          2
        )}`);
        await refreshBalances();
        await autoDeposit();
        await autoSwap();
      }, 3000);
      // Function returned from useEffect is the cleanup function, use it to stop the poller
      return () => {
        console.log(`Killing old poller w swapRate ${swapRate}`)
        shouldStop = true
      }
    })()
  // This effect should re-fire every time these dependencies change (just the loading flag)
  // We're getting warnings bc this effect technically depends on lots of other stuff
  // But including other dependencies makes this core poller effect fire too often
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConnext]);

  // ************************************************* //
  //                    Handlers                       //
  // ************************************************* //

  const scanQRCode = async (data) => {
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
        setSendScanArgs({ ...args })
        break;
      case "/redeem":
        setRedeemScanArgs({ ...args })
        break;
      default:
        break;
    }
    return path;
  }

  return (
    <Router>
      <Grid className={classes.app}>
        <Paper elevation={1} className={classes.paper}>
          <MySnackbar
            variant="warning"
            openWhen={loadingConnext}
            onClose={() => {}}
            message="Starting Channel Controllers.."
            duration={30 * 60 * 1000}
          />
          <AppBarComponent address={wallet.address || AddressZero} />
          <Route
            exact
            path="/"
            render={props => (
              <Grid>
                <Home
                  {...props}
                  balance={balance}
                  scanQRCode={scanQRCode}
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
                address={wallet.address || AddressZero}
                maxDeposit={maxDeposit}
                minDeposit={minDeposit}
              />
            )}
          />
          <Route path="/settings" render={props => <SettingsCard {...props} channel={channel} />} />
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
              <RedeemCard
                {...props}
                channel={channel}
                scanArgs={redeemScanArgs}
                tokenProfile={tokenProfile}
              />
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
                setPending={setPending}
                token={token}
              />
            )}
          />
          <Route
            path="/support"
            render={props => (
              <SupportCard
                {...props}
                channel={channel}
              />
            )}
          />
          <Confirmations
            pending={pending}
            closeConfirmations={() => setPending(pending => ({ ...pending, closed: true }))}
          />
        </Paper>
      </Grid>
    </Router>
  );
});
