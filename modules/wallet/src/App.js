import React, { Component } from "react";
import { getConnextClient } from "connext/dist/Connext.js";
import "./App.css";
import ProviderOptions from "./utils/ProviderOptions.ts";
import clientProvider from "./utils/web3/clientProvider.ts";
import { setWallet } from "./utils/actions.js";
import { createWallet, createWalletFromKey, findOrCreateWallet } from "./walletGen";
import { createStore } from "redux";
import axios from "axios";
import DepositCard from "./components/depositCard";
import SwapCard from "./components/swapCard";
import PayCard from "./components/payCard";
import WithdrawCard from "./components/withdrawCard";
import ChannelCard from "./components/channelCard";
import FullWidthTabs from "./components/walletTabs";
import Modal from "@material-ui/core/Modal";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
const Web3 = require("web3");
const Tx = require("ethereumjs-tx");
const eth = require("ethers");
//const util = require('ethereumjs-util')
require("dotenv").config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require("./abi/humanToken.json");

console.log(`starting app in env: ${JSON.stringify(process.env, null, 1)}`);
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase();
//const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()
const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS.toLowerCase();
const hubWalletAddress = process.env.REACT_APP_HUB_WALLET_ADDRESS.toLowerCase();
const channelManagerAddress = process.env.REACT_APP_CHANNEL_MANAGER_ADDRESS.toLowerCase();

const HASH_PREAMBLE = "SpankWallet authentication message:";

const BALANCE_THRESHOLD_WEI = eth.utils.parseEther('0.04') // 10FIN

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
      metamask: {
        address: null,
        balance: 0,
        tokenBalance: 0
      },
      usingMetamask: false,
      hubWallet: {
        address: hubWalletAddress,
        balance: 0,
        tokenBalance: 0
      },
      channelManager: {
        address: channelManagerAddress,
        balance: 0,
        tokenBalance: 0
      },
      authorized: "false",
      web3: null,
      wallet: null,
      address: null,
      balance: 0,
      tokenBalance: 0,
      browserWalletDeposit: {
        amountWei: "0",
        amountToken: "0"
      },
      toggleKey: false,
      walletSet: false,
      showWalletOptions: true,
      useExistingWallet: "existing",
      recovery: "",
      approvalWeiUser: "10000",
      recipient: hubWalletAddress,
      connext: null,
      channelState: null,
      exchangeRate: "0.00",
      tokenContract: null,
      useDelegatedSigner: true,
      delegatedSignerSelected: false,
      disableButtons: false,
      modalOpen: true,
      mnemonic: null
    };
    this.toggleKey = this.toggleKey.bind(this);
  }

  componentWillMount() {
    const resetHappened = localStorage.getItem("resetHappened");
    console.log(`reset value: ${resetHappened}`);
    if (resetHappened === "true") {
      console.log(`setting modal state`);
      this.setState({ modalOpen: false });
      console.log(`modal state set to true`);
    } else {
      this.setState({ modalOpen: true });
      console.log(`modal state set to false`);
    }
  }
  componentDidMount() {
    console.log(`didmount modal state: ${this.state.modalOpen}`);
    if (this.state.modalOpen === false) {
      this.chooseWalletHandler("existing");
      localStorage.setItem("resetHappened", "false");
    }
  }

  async setWalletAndProvider(metamask = false) {
    this.setState({ authorized: false });
    let web3;
    let address;
    // get metamask address defaults
    const windowProvider = window.web3;
    if (!windowProvider) {
      console.log("Metamask is not detected.");
    }
    const metamaskWeb3 = new Web3(windowProvider.currentProvider);

    try {
      if (metamask) {
        if (!windowProvider) {
          alert("You need to install & unlock metamask to do that");
          return;
        }
        address = (await metamaskWeb3.eth.getAccounts())[0].toLowerCase();
        if (!address) {
          alert("You need to install & unlock metamask to do that");
          return;
        }
        await this._walletCreateHandler();
        web3 = metamaskWeb3;
      } else {
        // New provider code
        console.log(`setwallet debug`);
        const providerOpts = new ProviderOptions(store).approving();
        const provider = clientProvider(providerOpts);
        web3 = new Web3(provider);
        console.log("GOT WEB3");
        // create wallet. TODO: maintain wallet or use some kind of auth instead of generating new one.
        // as is, if you don't write down the privkey in the store you can't recover the wallet
        await this.chooseWalletHandler();
        address = this.state.wallet.getAddressString().toLowerCase();
        console.log(`found address: ${JSON.stringify(address)}`);
      }

      await this.setState({ web3 });
      console.log("set up web3 successfully");

      console.log("wallet: ", this.state.wallet);
      // make sure wallet is linked to chain

      this.setState({ address });
      console.log("Set up wallet:", address);

      const tokenContract = new web3.eth.Contract(humanTokenAbi, tokenAddress);
      this.setState({ tokenContract });
      console.log("Set up token contract");
    } catch (error) {
      alert(`Failed to load web3 or Connext. Check console for details.`);
      console.log(error);
    }
  }

  async setConnext() {
    const { web3, hubWallet, address } = this.state;
    console.log(`instantiating connext with hub as: ${hubUrl}`);
    console.log(`web3 address : ${await web3.eth.getAccounts()}`);

    const opts = {
      web3,
      hubAddress: hubWallet.address,
      //"0xfb482f8f779fd96a857f1486471524808b97452d" ,
      hubUrl: hubUrl, //http://localhost:8080,
      contractAddress: channelManagerAddress, //"0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42",
      user: address.toLowerCase(),
      tokenAddress
    };

    console.log("Setting up connext with opts:", opts);

    // *** Instantiate the connext client ***
    const connext = getConnextClient(opts);

    console.log("Successfully set up connext!");

    await connext.start(); // start polling
    //console.log('Pollers started! Good morning :)')
    connext.on("onStateChange", state => {
      console.log("Connext state changed:", state);
      this.setState({
        channelState: state.persistent.channel
      });
    });

    this.setState({ connext });
    const channelState = connext.state ? connext.state.persistent.channel : null;
    this.setState({ channelState });
    console.log(`This is connext state: ${JSON.stringify(this.state.channelState, null, 2)}`);
  }

  async pollExchangeRate() {
    const getRate = async () => {
      const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH");
      const json = await response.json();
      console.log("latest ETH->USD exchange rate: ", json.data.rates.USD);
      this.setState({
        exchangeRate: json.data.rates.USD
      });
    };
    getRate();
    setInterval(() => {
      getRate();
    }, 10000);
  }

  async pollBrowserWallet() {
    const browserWalletDeposit = async () => {
      const tokenContract = this.state.tokenContract;
      const balance = await this.state.web3.eth.getBalance(this.state.address);
      const tokenBalance = await tokenContract.methods.balanceOf(this.state.address).call();
      console.log(`Polled onchain balance, weiBalance: ${balance}, tokenBalance: ${tokenBalance}`)
      if (balance !== "0" || tokenBalance !== "0") {
        this.setState({
          browserWalletDeposit: {
            amountWei: balance,
            amountToken: tokenBalance
          }
        });
        if (eth.utils.bigNumberify(balance).lte(BALANCE_THRESHOLD_WEI)) {
          // don't autodeposit anything under the threshold
          return
        }
        // const sendArgs = {
        //   from: this.state.channelState.user
        // }
        let approveFor = this.state.channelManager.address;
        let approveTx = await tokenContract.methods.approve(approveFor, this.state.browserWalletDeposit);
        console.log(approveTx);
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
          amountWei: eth.utils.bigNumberify(balance).sub(BALANCE_THRESHOLD_WEI).toString(),
          amountToken: tokenBalance
        }
        // TODO does this need to be in the state?
        this.setState({
          browserWalletDeposit: actualDeposit
        });
        console.log(`Depositing: ${JSON.stringify(actualDeposit, null, 2)}`);
        console.log("********", this.state.connext.opts.tokenAddress);
        let depositRes = await this.state.connext.deposit(actualDeposit);
        console.log(`Deposit Result: ${JSON.stringify(depositRes, null, 2)}`);
      }
    };
    browserWalletDeposit();
    setInterval(() => {
      browserWalletDeposit();
    }, 10000);
  }

  async approvalHandler(evt) {
    const web3 = this.state.web3;
    const tokenContract = this.state.tokenContract;
    const approveFor = channelManagerAddress;
    const toApprove = this.state.approvalWeiUser;
    const toApproveBn = eth.utils.bigNumberify(toApprove);
    const nonce = await web3.eth.getTransactionCount(this.state.wallet.address);
    const depositResGas = await tokenContract.methods.approve(approveFor, toApproveBn).estimateGas();
    let tx = new Tx({
      to: tokenAddress,
      nonce: nonce,
      from: this.state.wallet.address,
      gasLimit: depositResGas * 2,
      data: tokenContract.methods.approve(approveFor, toApproveBn).encodeABI()
    });
    tx.sign(Buffer.from(this.state.wallet.privateKey.substring(2), "hex"));
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

  //Connext Helpers

  // Other Helpers

  // stringToArray(bufferString) {
  //   let uint8Array = new TextEncoder("utf-8").encode(bufferString);
  //   return uint8Array;
  // }

  // arrayToString(bufferValue) {
  //   return new TextDecoder("utf-8").decode(bufferValue);
  // }

  getKey(evt) {
    console.log(store.getState()[0]);
    function _innerGetKey() {
      const key = localStorage.getItem("mnemonic");
      return key;
    }
    let privKey = _innerGetKey();
    this.toggleKey(evt);
    console.log(privKey);
    this.setState({ mnemonic: privKey });
    return privKey;
  }

  toggleKey(evt) {
    evt.preventDefault();
    this.setState(prevState => ({ toggleKey: !prevState.toggleKey }), () => {});
    this.setState({ mnemonic: null });
  }

  updateApprovalHandler(evt) {
    this.setState({
      approvalWeiUser: evt.target.value
    });
  }

  walletChangeHandler = selectedWallet => {
    this.setState({ selectedWallet });
    console.log(`Option selected:`, selectedWallet);
  };

  async handleMetamaskClose() {
    this.setState({ modalOpen: false });
    this.setState({ useDelegatedSigner: false });
    try {
      await this.setWalletAndProvider(true);
      await this.setConnext();
      await this.authorizeHandler();

      this.pollExchangeRate();
    } catch (e) {
      console.log(`failed to set provider or start connext: ${JSON.stringify(e)}`);
    }
  }

  async handleDelegatedSignerSelect() {
    await this.setState({ disableButtons: true });
    await this.setState({ delegatedSignerSelected: true });
    await this.setState({ useDelegatedSigner: true });
    //await this.walletFoundHandler()
  }

  async chooseWalletHandler(choice, recovery = null) {
    let wallet;
    if (choice === "new") {
      await this.chooseNewWallet();
      await this.setState({ showWalletOptions: false });
    } else if (choice === "existing") {
      await this.chooseExistingWallet();
      await this.closeModal("existing");
    } else if (choice === "recover") {
      await this.chooseRecoverWallet();
      await this.setState({ showWalletOptions: false });
    }
    console.log(`Chose wallet: ${JSON.stringify(this.state.useExistingWallet)}`);
    try {
      if (!this.state.walletSet) {
        wallet = await this._walletCreateHandler(this.state.useExistingWallet, recovery);
        console.log(`wallet: ${wallet}`);
        await this.setWalletAndProvider();
      }
      console.log(`debug1`);
      await this.setConnext();
      console.log(`debug2`);
      await this.authorizeHandler();
      console.log(`debug3`);

      this.pollExchangeRate();
      this.pollBrowserWallet();
    } catch (e) {
      console.log(`failed to set provider or start connext ${JSON.stringify(e)}`);
    }
    return wallet;
  }

  async walletFoundHandler() {
    let key = this.getKey();
    if (key) {
      this.setState({ walletFound: true });
    }
  }

  async _walletCreateHandler(recovery = null) {
    let wallet;
    let key;
    if (this.state.useExistingWallet === "existing") {
      wallet = await findOrCreateWallet(this.state.web3);
    } else if (this.state.useExistingWallet === "new") {
      wallet = await createWallet(this.state.web3);
    } else if (this.state.useExistingWallet === "recover" && recovery) {
      key = recovery;
      console.log(`creating wallet using recovery key: ${JSON.stringify(this.state.recovery)}`);
      wallet = await createWalletFromKey(key);
    }
    if (wallet) {
      console.log(`Wallet created!`);
    } else {
      alert(`Unable to create wallet. Try refreshing your page and starting over.`);
    }
    store.dispatch({
      type: "SET_WALLET",
      text: wallet
    });
    this.setState({ wallet: store.getState()[0] });

    this.setState({ walletSet: true });
    return wallet;
  }

  async chooseNewWallet(evt) {
    this.setState({ useExistingWallet: "new" });
  }

  async chooseExistingWallet(evt) {
    this.setState({ useExistingWallet: "existing" });
  }

  async chooseRecoverWallet(evt) {
    this.setState({ useExistingWallet: "recover" });
  }

  closeModal(choice) {
    if (choice !== "existing") {
      this.setState({ modalOpen: false });
      this.setState({ showWalletOptions: true });
      this.setState({ disableButtons: false });
      this.setState({ delegatedSignerSelected: false });
      this.setState({ useDelegatedSigner: false });
      this.setState({ mnemonic: null });
      localStorage.setItem("resetHappened", "true");
      window.location.reload(true);
    } else if (choice === "existing") {
      this.setState({ modalOpen: false });
      this.setState({ showWalletOptions: true });
      this.setState({ disableButtons: false });
      this.setState({ delegatedSignerSelected: false });
      this.setState({ useDelegatedSigner: false });
      this.setState({ mnemonic: null });
    }
  }

  updateWalletHandler(evt) {
    this.setState({
      recovery: evt.target.value
    });
    console.log(`Updating state : ${JSON.stringify(this.state.recovery)}`);
  }

  async createWallet() {
    await createWallet(this.state.web3);
  }

  async authorizeHandler(evt) {
    const web3 = this.state.web3;
    const challengeRes = await axios.post(`${hubUrl}/auth/challenge`, {}, opts);

    const hash = web3.utils.sha3(`${HASH_PREAMBLE} ${web3.utils.sha3(challengeRes.data.nonce)} ${web3.utils.sha3("localhost")}`);

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
      } else {
        this.setState({ authorized: false });
      }
      console.log(`Auth status: ${JSON.stringify(res.data)}`);
    } catch (e) {
      console.log(e);
    }
  }

  async collateralHandler() {
    console.log(`Requesting Collateral`);
    let collateralRes = await this.state.connext.requestCollateral();
    console.log(`Collateral result: ${JSON.stringify(collateralRes, null, 2)}`);
  }
  // to get tokens from metamask to browser wallet

  // ** wrapper for ethers getBalance. probably breaks for tokens

  render() {
    return (
      <div className="app">
        <Modal className="modal" aria-labelledby="simple-modal-title" aria-describedby="simple-modal-description" open={this.state.modalOpen}>
          <div className="modal_inner">
            <div className="row">
              <div className="column">
                <Button variant="contained" color="primary" disabled={this.state.disableButtons} onClick={() => this.handleMetamaskClose()}>
                  Use Metamask to sign
                </Button>
              </div>
              <div className="column">
                <Button variant="contained" color="primary" disabled={this.state.disableButtons} onClick={() => this.handleDelegatedSignerSelect()}>
                  Use Autosigner
                </Button>
              </div>
            </div>
            <div className="row">
              <div className="column">
                {this.state.delegatedSignerSelected ? (
                  <div>
                    <div>
                      {this.state.showWalletOptions ? (
                        <div>
                          <div>
                            <h4>
                              You have an autosigner set up already! <br />
                              You can either use it, recover an old one, or set up an entirely new one.{" "}
                            </h4>
                            <br />
                          </div>
                          <div>
                            <Button
                              style={{ padding: "15px 15px 15px 15px", marginRight: "15px" }}
                              variant="contained"
                              color="primary"
                              onClick={() => this.chooseWalletHandler("existing")}
                            >
                              Use Existing Signer
                            </Button>
                            <Button
                              style={{ padding: "15px 15px 15px 15px" }}
                              variant="contained"
                              color="primary"
                              onClick={() => this.chooseWalletHandler("new")}
                            >
                              Create New Signer
                            </Button>
                          </div>
                          <div style={{ display: "flex" }}>
                            <div style={{ width: "65%" }}>
                              <TextField
                                id="outlined-with-placeholder"
                                label="Mnemonic"
                                value={this.state.recovery}
                                onChange={evt => this.updateWalletHandler(evt)}
                                placeholder="12 word passphrase (e.g. hat avocado green....)"
                                margin="normal"
                                variant="outlined"
                                fullWidth
                              />
                            </div>
                            <div style={{ width: "35%" }}>
                              <Button
                                style={{ marginTop: "17px", marginLeft: "10px", padding: "15px 15px 15px 15px" }}
                                variant="contained"
                                color="primary"
                                onClick={() => this.chooseWalletHandler("recover", this.state.recovery)}
                              >
                                Recover Signer from Key
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          The following mnemonic is the recovery phrase for your signer.
                          <br />
                          If you lose it and are locked out of your signer, you will lose access
                          <br />
                          to any funds remaining in your channel. <br />
                          Keep it secret, keep it safe.
                          <br /> <br />
                          {this.toggleKey ? (
                            <Button variant="contained" color="primary" onClick={evt => this.getKey(evt)}>
                              Show Mnemonic
                            </Button>
                          ) : (
                            <Button variant="contained" color="primary" onClick={() => this.toggleKey()}>
                              Hide Mnemonic
                            </Button>
                          )}
                          {this.toggleKey ? <span>{this.state.mnemonic}</span> : null}
                          <br />
                          <div>
                            <Button variant="contained" onClick={() => this.closeModal("other")}>
                              {" "}
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Modal>
        <div className="row" style={{ justifyContent: "center" }}>
          <img style={{ height: "70px", width: "300px" }} src="https://connext.network/static/media/logoHorizontal.3251cc60.png" />
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <div className="column">
            <ChannelCard 
              channelState={this.state.channelState} 
              address={this.state.address} 
            />
          </div>
          <div className="column">
            <FullWidthTabs
              connext={this.state.connext}
              metamask={this.state.metamask}
              channelManager={this.state.channelManager}
              hubWallet={this.state.hubWallet}
              web3={this.state.web3}
              tokenContract={this.state.tokenContract}
            />
            <div style={{ display: "flex", marginLeft: "10%" }}>
              <div style={{ marginRight: "10px" }}>
                <Button variant="contained" color="primary" onClick={() => this.setState({ modalOpen: true })}>
                  Select Signer
                </Button>
              </div>
              <div>
                <Button variant="contained" color="primary" onClick={() => this.collateralHandler()}>
                  Request Collateral
                </Button>
              </div>
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
              humanTokenAbi={humanTokenAbi}
              connext={this.state.connext}
            />
          </div>
          <div className="column">
            <SwapCard connext={this.state.connext} exchangeRate={this.state.exchangeRate} />
          </div>
          <div className="column">
            <PayCard connext={this.state.connext} />
          </div>
          <div className="column">
            <WithdrawCard connext={this.state.connext} exchangeRate={this.state.exchangeRate} />
          </div>
        </div>
        <div className="row">
          <div className="column">Made with 💛 by the Connext Team</div>
        </div>

        {/* <button className="btn" onClick={() => this.createWallet()}>
                  Create New Browser Wallet
                </button>
              </div>
            ) : (
                <div>
                  Enter your private key. If you do not have a wallet, leave blank and we'll create one for you.
                <div>
                    <input defaultValue={""} onChange={evt => this.updateWalletHandler(evt)} />
                  </div>
                  <button className="btn">Get wallet</button> */}
      </div>
    );
  }
}

export default App;
