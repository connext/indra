import React, { Component } from "react";
import { getConnextClient } from "connext/dist/Connext.js";
import "./App.css";
import ProviderOptions from "./utils/ProviderOptions.ts";
import clientProvider from "./utils/web3/clientProvider.ts";
import { setWallet } from "./utils/actions.js";
import {
  createWallet,
  createWalletFromMnemonic
} from "./walletGen";
import { createStore } from "redux";
import axios from "axios";
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
import Modal from "@material-ui/core/Modal";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Popover from "@material-ui/core/Popover";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Connext from "./assets/Connext.svg";
import { Typography } from "@material-ui/core";
const Web3 = require("web3");
const Tx = require("ethereumjs-tx");
const eth = require("ethers");
const tokenAbi = require("./abi/humanToken.json");
require("dotenv").config();

console.log(`starting app in env: ${JSON.stringify(process.env, null, 1)}`);
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase();
//const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()

const HASH_PREAMBLE = "SpankWallet authentication message:";
const DEPOSIT_MINIMUM_WEI = eth.utils.parseEther("0.04"); // 40FIN

const opts = {
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: "Bearer foo"
  },
  withCredentials: true
};

export const store = createStore(setWallet, null);

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      web3: null,
      customWeb3: null,
      tokenContract: null,
      modalOpen: false,
      connext: null,
      delegateSigner: null,
      delegateAddress:null,
      metamask: {
        address: null,
        balance: 0,
        tokenBalance: 0
      },
      hubWallet: {
        address: '0x00',
        balance: 0,
        tokenBalance: 0
      },
      channelManager: {
        address: '0x00',
        balance: 0,
        tokenBalance: 0
      },
      authorized: "false",
      approvalWeiUser: "10000",
      recipient: '0x00',
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
    const mnemonic = localStorage.getItem("mnemonic")

    // If a browser address exists, create wallet
    if (mnemonic) {
      const delegateSigner = await createWalletFromMnemonic(mnemonic)
      const address = await delegateSigner.getAddressString();
      this.setState({delegateSigner, address})
      store.dispatch({
        type: "SET_WALLET",
        text: delegateSigner
      });
    } else {// Else, we wait for user to finish selecting through modal which will refresh page when done
      this.setState({ modalOpen: true });
    }
  }

  async componentDidMount() {
    await this.setWindowWeb3();
    // If a browser address exists, instantiate connext
    if (this.state.delegateSigner) {
      await this.setConnext();
      await this.checkNetIds();
      await this.authorizeHandler();
      await this.setTokenContract();
      await this.setHubDetails();
      await this.setChannelManagerDetails();
      await this.setMetamaskDetails();
      await this.pollConnextState();
      await this.poller();

    // Else, we wait for user to finish selecting through modal which will refresh page when done
    } else {
      this.setState({ modalOpen: true });
    }
  }

  // ************************************************* //
  //                State setters                      //
  // ************************************************* //    

  async setWindowWeb3() {
    // Ask permission to view accounts
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      try {
        // Request account access if needed
        await window.ethereum.enable();
      } catch (error) {
        console.error(error)
      }
    }
    const windowProvider = window.web3;
    if (!windowProvider) {
      alert("Metamask is not detected.");
    }
    const web3 = new Web3(windowProvider.currentProvider);
    // make sure you are on localhost
    this.setState({web3})
    return;
  }

  async setConnext() {
    // const { hubWallet, channelManager, tokenContract, address } = this.state;
    const { address } = this.state;
    const providerOpts = new ProviderOptions(store).approving();
    const provider = clientProvider(providerOpts);
    const customWeb3 = new Web3(provider);
    const opts = {
      web3: customWeb3,
      hubUrl: hubUrl, //http://localhost/hub,
      user: address
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
      customWeb3,
      tokenAddress: connext.opts.tokenAddress,
      channelManagerAddress: connext.opts.contractAddress,
      hubWalletAddress: connext.opts.hubAddress,
      ethNetworkId: connext.opts.ethNetworkId
    });
  }

  async checkNetIds() {
    const { web3, connext, customWeb3 } = this.state
    const walletNetId = String(await customWeb3.eth.net.getId())
    const metamaskNetId = String(await web3.eth.net.getId())
    if (walletNetId !== metamaskNetId || walletNetId !== connext.opts.ethNetworkId) {
      alert(`
        WARNING: network id mismatch.\n
        Metamask network: ${metamaskNetId}\n
        Wallet network: ${walletNetId}\n
        Hub network: ${connext.opts.ethNetworkId}
      `);
    } else {
      console.log(`All providers are using network ${walletNetId}`)
    }
  }

  async setTokenContract() {
    try {
      let { web3, connext, tokenContract } = this.state;
      tokenContract = new web3.eth.Contract(tokenAbi, connext.opts.tokenAddress);
      this.setState({ tokenContract });
      console.log(`Done setting up token contract at ${tokenContract._address}`)
    } catch (e) {
      console.log("Error setting token contract")
      console.log(e)
    }
  }

  async setHubDetails() {
    try {
      let {connext, web3, hubWallet, tokenContract} = this.state;
      hubWallet.address = connext.opts.hubAddress
      hubWallet.balance = await web3.eth.getBalance(hubWallet.address);
      console.log(`ping ${tokenContract._address}`)
      hubWallet.tokenBalance = await tokenContract.methods.balanceOf(hubWallet.address).call();
      console.log(`ping ${hubWallet.tokenBalance}`)
      this.setState({ hubWallet })
      console.log(`Done setting hub details for address ${hubWallet.address}`)
    } catch (e) {
      console.log("Error setting hub details")
      console.log(e)
    }
  }

  async setChannelManagerDetails() {
    try {
      let {connext, web3, channelManager, tokenContract} = this.state;
      channelManager.address = connext.opts.contractAddress
      channelManager.balance = await web3.eth.getBalance(channelManager.address);
      channelManager.tokenBalance = await tokenContract.methods.balanceOf(channelManager.address.toString()).call();
      this.setState({channelManager})
      console.log(`Done setting channel manager details for address ${channelManager.address}`)
    } catch (e) {
      console.log("Error setting Channel Manager details")
      console.log(e)
    }
  }

  async setMetamaskDetails() {
    try {
      let { web3, metamask, tokenContract } = this.state;
      metamask.address = (await web3.eth.getAccounts())[0].toLowerCase();
      metamask.balance = await web3.eth.getBalance(metamask.address);
      metamask.tokenBalance = await tokenContract.methods.balanceOf(metamask.address).call();
      this.setState({metamask});
      console.log(`Done setting metamask details for address ${metamask.address}`)
    } catch (e) {
      console.log("Error setting Metamask details")
      console.log(e)
    }
  }

  // ************************************************* //
  //                    Pollers                        //
  // ************************************************* //   

  async pollConnextState() {
    let connext = this.state.connext
    connext.on("onStateChange", state => {
      console.log("Connext state changed:", state);
      this.setState({
        channelState: state.persistent.channel,
        connextState: state,
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
    }, 1000)
  }
  
  async getRate() {
    const response = await fetch(
      "https://api.coinbase.com/v2/exchange-rates?currency=ETH"
    );
    const json = await response.json();
    this.setState({
      exchangeRate: json.data.rates.USD
    });
  }

  async browserWalletDeposit() {
    if (!this.state.connextState || !this.state.connextState.runtime.canDeposit) {
      console.log('Cannot deposit.')
      return
    }

    // if a deposit has been requested, then you shou
    let address = this.state.address;
    const tokenContract = this.state.tokenContract;
    const balance = await this.state.web3.eth.getBalance(address);
    const tokenBalance = await tokenContract.methods
      .balanceOf(address)
      .call();
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
        console.log('Actual deposit value is 0 for both wei and tokens. Not depositing.')
        return
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

  async authorizeHandler() {
    const web3 = this.state.customWeb3;
    const challengeRes = await axios.post(`${hubUrl}/auth/challenge`, {}, opts);

    const hash = web3.utils.sha3(
      `${HASH_PREAMBLE} ${web3.utils.sha3(
        challengeRes.data.nonce
      )} ${web3.utils.sha3("localhost")}`
    );

    const signature = await web3.eth.personal.sign(hash, this.state.address);

    try {
      let authRes = await axios.post(
        `${hubUrl}/auth/response`,
        {
          nonce: challengeRes.data.nonce,
          address: this.state.address,
          origin: "localhost",
          signature
        },
        opts
      );
      const token = authRes.data.token;
      document.cookie = `hub.sid=${token}`;
      console.log(`cookie set: ${token}`);
      const res = await axios.get(`${hubUrl}/auth/status`, opts);
      if (res.data.success) {
        this.setState({ authorized: true });
        return res.data.success
      } else {
        this.setState({ authorized: false });
      }
      console.log(`Auth status: ${JSON.stringify(res.data)}`);
    } catch (e) {
      console.log(e);
    }
  }

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
    })
  }

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
    const {channelManager, tokenContract, address } = this.state;
    const web3 = this.state.customWeb3;
    const approveFor = channelManager.address;
    const toApprove = this.state.approvalWeiUser;
    const toApproveBn = eth.utils.bigNumberify(toApprove);
    const nonce = await web3.eth.getTransactionCount(address);
    const depositResGas = await tokenContract.methods
      .approve(approveFor, toApproveBn)
      .estimateGas();
    let tx = new Tx({
      to: tokenContract.address,
      nonce: nonce,
      from: address,
      gasLimit: depositResGas * 2,
      data: tokenContract.methods.approve(approveFor, toApproveBn).encodeABI()
    });
    tx.sign(Buffer.from(this.state.delegateSigner.getPrivateKeyString().substring(2), "hex"));
    let signedTx = "0x" + tx.serialize().toString("hex");
    let sentTx = web3.eth.sendSignedTransaction(signedTx, err => {
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
  // NOTE: DelegateSigner is always recovered from browser storage. 
  //       It is ONLY set to state from within app on load.
    await createWallet(this.state.web3);
    // Then refresh the page
    window.location.reload();
  }

  // to get tokens from metamask to browser wallet

  // ** wrapper for ethers getBalance. probably breaks for tokens

  render() {
    const { anchorEl, connextState } = this.state;
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
                  First, you need to send funds to your channel. You can either
                  manually send them to the address shown in the Channel
                  Information, or you can use the UX below to fetch ETH or
                  tokens from your Metamask account. Enter the amount in Wei,
                  tokens, or both, and then click Get and sign the popup--we'll
                  do the rest! If you're using an Autosigner, we'll leave a
                  small amount of ETH in the autosigner wallet to cover gas
                  fees, but you'll get it all back when you withdraw.{" "}
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 2: Swap ETH for Tokens
                </Typography>
                <Typography>
                  This step is OPTIONAL. If you'd like to swap ETH for tokens,
                  you can do it in-channel. Just enter the amount of ETH you'd
                  like to swap, using the exchange rate provided.
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 3: Pay
                </Typography>
                <Typography>
                  Here, you can pay a counterparty using your offchain funds.
                  Enter the recipient address and the amount in tokens or ETH,
                  then click Pay. Everything's offchain, so no gas is necessary
                  and the payment is instant.{" "}
                </Typography>
                <Typography variant="h4" style={{ marginTop: "20px" }}>
                  Step 4: Withdraw
                </Typography>
                <Typography>
                  When you're done making payments, you'll want to withdraw
                  funds from your channel. Enter the recipient address (most
                  likely an address that you control) and the amount, then click
                  Withdraw.{" "}
                </Typography>
                <Typography variant="h5" style={{ marginTop: "40px" }}>
                  A note about autosigners
                </Typography>
                <Typography>
                  We use autosigners to cut down on the number of MetaMask
                  popups that show up in the course of conducting an offchain
                  transaction. An autosigner is an inpage wallet which uses a
                  custom Web3 implementation to automatically sign all
                  transactions initiated by the user via the UX. Private keys
                  are stored securely in browser storage.{" "}
                </Typography>
              </div>
            </Popover>
          </Toolbar>
        </AppBar>
        <div className="app">
          <Modal
            className="modal"
            aria-labelledby="Delegate Signer Options"
            aria-describedby="simple-modal-description"
            open={this.state.modalOpen}
          >
            <div className="modal_inner">
              <div className="row">
                {this.state.delegateSigner? (
                  <div className="column">
                    <div>
                      <h4>
                        You have a delegate signer set up already! <br />
                        You can get your current mnemonic, recover an 
                        old signer from a mnemonic , or
                        set up an entirely delegate signer.{" "}
                      </h4>
                    </div>
                    <div>
                      {this.setState.showMnemonic ? (
                        <div>
                          <Button
                            style={{
                              padding: "15px 15px 15px 15px",
                              marginRight: "15px"
                            }}
                            variant="contained"
                            color="primary"
                            onClick={() =>
                              this.setState({showMnemonic: true})
                            }
                          >
                            See Mnemonic (click to copy)
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <TextField
                            id="outlined-with-placeholder"
                            label="Mnemonic"
                            value={this.state.delegateSigner.mnemonic}
                            onChange={evt =>
                              this.updateWalletHandler(evt)
                            }
                            placeholder="12 word passphrase (e.g. hat avocado green....)"
                            margin="normal"
                            variant="outlined"
                            fullWidth
                          />
                          <CopyToClipboard
                            style={{ cursor: "pointer" }}
                            text={this.state.delegateSigner.mnemonic}
                          >
                            <span>{this.state.delegateSigner.mnemonic}</span>
                          </CopyToClipboard>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={evt => this.setState({showMnemonic: false})}
                          >
                            Hide Mnemonic
                          </Button>
                        </div>
                      )}
                      <Button
                        style={{ padding: "15px 15px 15px 15px" }}
                        variant="contained"
                        color="primary"
                        onClick={() => this.generateNewDelegateSigner()}
                      >
                        Create New Signer (will refresh page)
                      </Button>
                    </div>
                    <div>
                      {/* <TextField
                        id="outlined-with-placeholder"
                        label="Recover Signer"
                        value={this.state.delegateSigner.mnemonic}
                        onS={evt =>
                          this.updateWalletHandler(evt)
                        }
                        placeholder="12 word passphrase (e.g. hat avocado green....)"
                        margin="normal"
                        variant="outlined"
                        fullWidth
                      /> */}
                      <Button
                          style={{ padding: "15px 15px 15px 15px" }}
                          variant="contained"
                          color="primary"
                          onClick={() => this.generateNewDelegateSigner()}
                        >
                        Recover delegate signer from mnemonic (does nothing for now)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="column">
                      <Button
                        style={{ padding: "15px 15px 15px 15px" }}
                        variant="contained"
                        color="primary"
                        onClick={() => this.generateNewDelegateSigner()}
                      >
                        Create New Signer (will refresh page)
                      </Button>
                  </div>
                )}
              </div>
            </div>
          </Modal>
          <div className="row">
            <div
              className="column"
              style={{ justifyContent: "space-between", flexGrow: 1 }}
            >
              <ChannelCard
                channelState={this.state.channelState}
                address={this.state.address}
              />
            </div>
            <div className="column" style={{ flexGrow: 1 }}>
              <FullWidthTabs
                connext={this.state.connext}
                metamask={this.state.metamask}
                channelManager={this.state.channelManager}
                hubWallet={this.state.hubWallet}
                web3={this.state.web3}
                tokenContract={this.state.tokenContract}
              />
              <div>
                <Button
                  style={{
                    width: "235px",
                    marginRight: "5px",
                    color: "#FFF",
                    backgroundColor: "#FCA311"
                  }}
                  variant="contained"
                  onClick={() => this.setState({ modalOpen: true })}
                >
                  Reselect Signer
                </Button>
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
                channelManagerAddress={this.state.channelManager.address}
                Web3={window.web3}
                balance={this.state.balance}
                tokenBalance={this.state.tokenBalance}
                tokenContract={this.state.tokenContract}
                tokenAbi={tokenAbi}
                connext={this.state.connext}
                metamask={this.state.metamask}
                connextState={this.state.connextState}
              />
            </div>
            <div className="column">
              <SwapCard 
                connext={this.state.connext} 
                exchangeRate={this.state.exchangeRate} 
                channelState={this.state.channelState}
                connextState={this.state.connextState}
              />
            </div>
            <div className="column">
              <PayCard 
                connext={this.state.connext}
                channelState={this.state.channelState}
                web3={this.state.web3}
                connextState={this.state.connextState} 
              />
            </div>
            <div className="column">
              <WithdrawCard
                connext={this.state.connext}
                exchangeRate={this.state.exchangeRate}
                metamask={this.state.metamask}
                channelManager={this.state.channelManager}
                hubWallet={this.state.hubWallet}
                channelState={this.state.channelState}
                web3={this.state.web3}
                connextState={this.state.connextState} 
              />
            </div>
          </div>
          <div className="row">
            <div className="column">Made with <span role="img" aria-labelledby="love">💛</span> by the Connext Team</div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
