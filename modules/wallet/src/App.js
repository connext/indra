import React, { Component } from "react";
import { getConnextClient } from "connext/dist/Connext.js";
import "./App.css";
import ProviderOptions from "./utils/ProviderOptions.ts";
import clientProvider from "./utils/web3/clientProvider.ts";
import { setWallet } from "./utils/actions.js";
import { createWallet, createWalletFromMnemonic } from "./walletGen";
import { createStore } from "redux";
import DepositCard from "./components/depositCard";
import SwapCard from "./components/swapCard";
import PayCard from "./components/payCard";
import WithdrawCard from "./components/withdrawCard";
import ChannelCard from "./components/channelCard";
import FullWidthTabs from "./components/walletTabs";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import InfoIcon from "@material-ui/icons/Info";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Popover from "@material-ui/core/Popover";
import Connext from "./assets/Connext.svg";
import { Typography } from "@material-ui/core";
const Web3 = require("web3");
const Tx = require("ethereumjs-tx");
const eth = require("ethers");
const tokenAbi = require("./abi/humanToken.json");
require("dotenv").config();

const DEPOSIT_MINIMUM_WEI = eth.utils.parseEther("0.04"); // 40FIN

const overrides = {
  localHub: process.env.REACT_APP_LOCAL_HUB_OVERRIDE,
  localEth: process.env.REACT_APP_LOCAL_ETH_OVERRIDE,
  rinkebyHub: process.env.REACT_APP_RINKEBY_HUB_OVERRIDE,
  rinkebyEth: process.env.REACT_APP_RINKEBY_ETH_OVERRIDE,
  mainnetHub: process.env.REACT_APP_MAINNET_HUB_OVERRIDE,
  mainnetEth: process.env.REACT_APP_MAINNET_ETH_OVERRIDE
};

let publicUrl;

export const store = createStore(setWallet, null);

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      customWeb3: null,
      tokenContract: null,
      tokenAddress: null,
      connext: null,
      address: null,
      metamask: {
        address: null,
        balance: 0,
        tokenBalance: 0
      },
      hubWalletAddress: "",
      channelManagerAddress: "",
      authorized: "false",
      approvalWeiUser: "10000",
      recipient: "0x00",
      channelState: null,
      exchangeRate: "0.00",
      anchorEl: null,
      interval: null
    };
  }

  // ************************************************* //
  //                     Hooks                         //
  // ************************************************* //

  async componentWillMount() {
    const mnemonic = localStorage.getItem("mnemonic");

    let delegateSigner
    let address
    // If a browser address exists, create wallet
    if (mnemonic) {
      delegateSigner = await createWalletFromMnemonic(mnemonic);
    } else {
      delegateSigner = await createWallet()
    }

    address = await delegateSigner.getAddressString();
    this.setState({ delegateSigner, address });
    store.dispatch({
      type: "SET_WALLET",
      text: delegateSigner
    });
  }

  async componentDidMount() {
    await this.setWeb3();
    await this.setConnext();
    await this.checkNetIds();
    await this.setTokenContract();
    await this.pollConnextState();
    await this.poller();

    publicUrl = window.location.origin.toLowerCase();
  }

  // ************************************************* //
  //                State setters                      //
  // ************************************************* //

  // either LOCALHOST MAINNET or RINKEBY
  async setWeb3(rpc) {
    const rpcUrl = overrides.localEth || `${publicUrl}/api/local/eth`;
    const hubUrl = overrides.localHub || `${publicUrl}/api/local/hub`;

    // Ask permission to view accounts
    let windowId;
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      windowId = await window.web3.eth.net.getId();
    }

    const providerOpts = new ProviderOptions(store, rpcUrl, hubUrl).approving();
    const provider = clientProvider(providerOpts);
    const customWeb3 = new Web3(provider);
    const customId = await customWeb3.eth.net.getId();
    // NOTE: token/contract/hubWallet ddresses are set to state while initializing connext
    this.setState({ customWeb3, hubUrl, rpcUrl });
    if (windowId && windowId !== customId) {
      alert(`Your card is set to ${JSON.stringify(rpc)}. To avoid losing funds, please make sure your metamask and card are using the same network.`);
    }
    return;
  }

  async setTokenContract() {
    try {
      let { customWeb3, tokenAddress } = this.state;
      const tokenContract = new customWeb3.eth.Contract(tokenAbi, tokenAddress);
      this.setState({ tokenContract });
    } catch (e) {
      console.log("Error setting token contract");
      console.log(e);
    }
  }

  async setConnext() {
    const { address, customWeb3, hubUrl } = this.state;

    const opts = {
      web3: customWeb3,
      hubUrl, // in dev-mode: http://localhost:8080,
      user: address,
      origin: "localhost" // TODO: what should this be
    };

    // *** Instantiate the connext client ***
    const connext = await getConnextClient(opts);
    console.log(`Successfully set up connext! Connext config:`);
    console.log(`  - tokenAddress: ${connext.opts.tokenAddress}`);
    console.log(`  - hubAddress: ${connext.opts.hubAddress}`);
    console.log(`  - contractAddress: ${connext.opts.contractAddress}`);
    console.log(`  - ethNetworkId: ${connext.opts.ethNetworkId}`);
    this.setState({
      connext,
      tokenAddress: connext.opts.tokenAddress,
      hubWalletAddress: connext.opts.hubAddress,
      channelManagerAddress: connext.opts.contractAddress,
      ethNetworkId: connext.opts.ethNetworkId
    });
  }

  async checkNetIds() {
    const { connext, customWeb3 } = this.state;
    const walletNetId = String(await customWeb3.eth.net.getId());
    console.log("connext.opts: ", connext.opts);
    if (walletNetId !== connext.opts.ethNetworkId) {
      alert(`
        WARNING: network id mismatch.\n
        Wallet network: ${walletNetId}\n
        Hub network: ${connext.opts.ethNetworkId}
      `);
    } else {
      console.log(`All providers are using network ${walletNetId}`);
    }
  }

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //

  async pollConnextState() {
    let connext = this.state.connext;
    connext.on("onStateChange", state => {
      console.log("Connext state changed:", state);
      this.setState({
        channelState: state.persistent.channel,
        connextState: state
      });
    });
    await connext.start(); // start polling
    //console.log('Pollers started! Good morning :)')
  }

  async poller() {
    await this.getRate();
    await this.browserWalletDeposit();

    setInterval(async () => {
      await this.getRate();
      await this.browserWalletDeposit();
    }, 1000);
  }

  async getRate() {
    const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH");
    const json = await response.json();
    this.setState({
      exchangeRate: json.data.rates.USD
    });
  }

  async browserWalletDeposit() {
    const { connextState, address, tokenContract, customWeb3 } = this.state;
    if (!connextState || !connextState.runtime.canDeposit) {
      console.log("Cannot deposit.");
      return;
    }

    // if a deposit has been requested, then you shou
    const balance = await customWeb3.eth.getBalance(address);
    const tokenBalance = await tokenContract.methods.balanceOf(address).call();
    //console.log('browser wallet wei balance:', balance)
    if (balance !== "0" || tokenBalance !== "0") {
      if (eth.utils.bigNumberify(balance).lt(DEPOSIT_MINIMUM_WEI)) {
        // don't autodeposit anything under the threshold
        return;
      }
      // const sendArgs = {
      //   from: this.state.channelState.user
      // }
      // const gasEstimate = await approveTx.estimateGas(sendArgs)
      // if (gasEstimate > this.state.browserWalletDeposit.amountWei){
      //   throw "Not enough wei for gas"
      // }
      // if (gasEstimate < this.state.browserWalletDeposit.amountWei){
      //   const depositDiff = balance - gasEstimate
      //   this.setState({
      //     browserWalletDeposit:{
      //       amountWei: depositDiff,
      //       amountToken: tokenBalance
      //     }})
      // }
      const actualDeposit = {
        amountWei: eth.utils
          .bigNumberify(balance)
          .sub(DEPOSIT_MINIMUM_WEI)
          .toString(),
        amountToken: tokenBalance
      };
      if (actualDeposit.amountToken === "0" && actualDeposit.amountWei === "0") {
        console.log("Actual deposit value is 0 for both wei and tokens. Not depositing.");
        return;
      }
      // TODO does this need to be in the state?
      console.log(`Depositing: ${JSON.stringify(actualDeposit, null, 2)}`);
      console.log("********", this.state.connext.opts.tokenAddress);
      let depositRes = await this.state.connext.deposit(actualDeposit);
      console.log(`Deposit Result: ${JSON.stringify(depositRes, null, 2)}`);
    }
  }

  // ************************************************* //
  //                    Handlers                       //
  // ************************************************* //

  handleClick = event => {
    this.setState({
      anchorEl: event.currentTarget
    });
  };

  handleClose = () => {
    this.setState({
      anchorEl: null
    });
  };

  handleModalClose = () => {
    this.setState({
      modalOpen: false
    });
  };

  updateApprovalHandler(evt) {
    this.setState({
      approvalWeiUser: evt.target.value
    });
  }

  async collateralHandler() {
    console.log(`Requesting Collateral`);
    let collateralRes = await this.state.connext.requestCollateral();
    console.log(`Collateral result: ${JSON.stringify(collateralRes, null, 2)}`);
  }

  async approvalHandler() {
    const { channelManager, tokenContract, address, customWeb3 } = this.state;
    const approveFor = channelManager.address;
    const toApprove = this.state.approvalWeiUser;
    const toApproveBn = eth.utils.bigNumberify(toApprove);
    const nonce = await customWeb3.eth.getTransactionCount(address);
    const depositResGas = await tokenContract.methods.approve(approveFor, toApproveBn).estimateGas();
    let tx = new Tx({
      to: tokenContract.address,
      nonce: nonce,
      from: address,
      gasLimit: depositResGas * 2,
      data: tokenContract.methods.approve(approveFor, toApproveBn).encodeABI()
    });
    tx.sign(Buffer.from(this.state.delegateSigner.getPrivateKeyString().substring(2), "hex"));
    let signedTx = "0x" + tx.serialize().toString("hex");
    let sentTx = customWeb3.eth.sendSignedTransaction(signedTx, err => {
      if (err) console.error(err);
    });
    sentTx
      .once("transactionHash", hash => {
        console.log(`tx broadcasted, hash: ${hash}`);
      })
      .once("receipt", receipt => {
        console.log(`tx mined, receipt: ${JSON.stringify(receipt)}`);
      });
    console.log(`Sent tx: ${typeof sentTx} with keys ${Object.keys(sentTx)}`);
  }

  async generateNewDelegateSigner() {
    const { customWeb3 } = this.state;
    // NOTE: DelegateSigner is always recovered from browser storage.
    //       It is ONLY set to state from within app on load.
    await createWallet(customWeb3);
    // Then refresh the page
    window.location.reload();
  }

  // to get tokens from metamask to browser wallet

  // ** wrapper for ethers getBalance. probably breaks for tokens

  render() {
    const {
      anchorEl,
      connextState,
      connext,
      customWeb3,
      channelManagerAddress,
      channelState,
      balance,
      tokenBalance,
      metamask,
      hubWalletAddress,
      tokenContract,
      exchangeRate,
      address
    } = this.state;
    const open = Boolean(anchorEl);
    return (
      <div>
        <AppBar position="sticky" color="secondary">
          <Toolbar>
            <img src={Connext} style={{ width: "60px", height: "60px" }} alt="" />
            <Typography variant="h6" style={{ flexGrow: 1 }} />
            <IconButton
              color="inherit"
              aria-label="Menu"
              aria-owns={open ? "simple-popper" : undefined}
              aria-haspopup="true"
              variant="contained"
              onClick={this.handleClick}
            >
              <InfoIcon />
            </IconButton>
            <Popover
              id="simple-popper"
              open={open}
              anchorEl={anchorEl}
              onClose={this.handleClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "center"
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "center"
              }}
              style={{ width: "75%" }}
            >
              <div
                style={{
                  padding: "20px 20px 20px 20px",
                  boxShadow: "1px 1px 1px 1px black"
                }}
              >
                <Typography variant="h3">Connext Demo Wallet</Typography>
                <Typography variant="h4" style={{ marginTop: "40px" }}>
                  Step 1: Deposit to channel
                </Typography>
                <Typography>
                  First, you need to send funds to your channel. You can either manually send them to the address shown in the Channel Information, or
                  you can use the UX below to fetch ETH or tokens from your Metamask account. Enter the amount in Wei, tokens, or both, and then click
                  Get and sign the popup--we'll do the rest! If you're using an Autosigner, we'll leave a small amount of ETH in the autosigner wallet
                  to cover gas fees, but you'll get it all back when you withdraw.{" "}
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 2: Swap ETH for Tokens
                </Typography>
                <Typography>
                  This step is OPTIONAL. If you'd like to swap ETH for tokens, you can do it in-channel. Just enter the amount of ETH you'd like to
                  swap, using the exchange rate provided.
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 3: Pay
                </Typography>
                <Typography>
                  Here, you can pay a counterparty using your offchain funds. Enter the recipient address and the amount in tokens or ETH, then click
                  Pay. Everything's offchain, so no gas is necessary and the payment is instant.{" "}
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 4: Withdraw
                </Typography>
                <Typography>
                  When you're done making payments, you'll want to withdraw funds from your channel. Enter the recipient address (most likely an
                  address that you control) and the amount, then click Withdraw.{" "}
                </Typography>
                <Typography variant="h5" style={{ marginTop: "40px" }}>
                  A note about autosigners
                </Typography>
                <Typography>
                  We use autosigners to cut down on the number of MetaMask popups that show up in the course of conducting an offchain transaction. An
                  autosigner is an inpage wallet which uses a custom Web3 implementation to automatically sign all transactions initiated by the user
                  via the UX. Private keys are stored securely in browser storage.{" "}
                </Typography>
              </div>
            </Popover>
          </Toolbar>
        </AppBar>
        <div className="app">
          <div className="row">
            <div className="column" style={{ justifyContent: "space-between", flexGrow: 1 }}>
              <ChannelCard channelState={channelState} address={address} />
            </div>
            <div className="column" style={{ flexGrow: 1 }}>
              <FullWidthTabs
                connext={connext}
                metamask={metamask}
                channelManagerAddress={channelManagerAddress}
                hubWalletAddress={hubWalletAddress}
                web3={customWeb3}
                tokenContract={tokenContract}
              />
              <div>
                <Button
                  style={{
                    width: "235px",
                    color: "#FFF",
                    backgroundColor: "#FCA311"
                  }}
                  variant="contained"
                  onClick={() => this.collateralHandler()}
                  disabled={!connextState || !connextState.runtime.canWithdraw}
                >
                  Request Collateral
                </Button>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="column">
              <DepositCard
                channelManagerAddress={channelManagerAddress}
                Web3={window.web3}
                balance={balance}
                tokenBalance={tokenBalance}
                tokenContract={tokenContract}
                tokenAbi={tokenAbi}
                connext={connext}
                metamask={metamask}
                connextState={connextState}
              />
            </div>
            <div className="column">
              <SwapCard connext={connext} exchangeRate={exchangeRate} channelState={channelState} connextState={connextState} />
            </div>
            <div className="column">
              <PayCard connext={connext} channelState={channelState} web3={customWeb3} connextState={connextState} />
            </div>
            <div className="column">
              <WithdrawCard
                connext={connext}
                exchangeRate={exchangeRate}
                metamask={metamask}
                channelManagerAddress={channelManagerAddress}
                hubWalletAddress={hubWalletAddress}
                channelState={channelState}
                web3={customWeb3}
                connextState={connextState}
              />
            </div>
          </div>
          <div className="row">
            <div className="column">
              Made with{" "}
              <span role="img" aria-labelledby="love">
                💛
              </span>{" "}
              by the Connext Team
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
