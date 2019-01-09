import React, { Component } from 'react';
import { getConnextClient } from 'connext/dist/Connext';
import './App.css';
import ProviderOptions from './utils/ProviderOptions.ts';
import clientProvider from './utils/web3/clientProvider.ts';
import * as eth from 'ethers';
import { setWallet } from './utils/actions.js';
import { createWallet, createWalletFromKey, findOrCreateWallet } from './walletGen';
import { createStore } from 'redux';
import axios from 'axios';
const Web3 = require('web3');
require('dotenv').config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require('./abi/humanToken.json')

console.log(`starting app in env: ${JSON.stringify(process.env, null, 1)}`)
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase()
const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()
const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS.toLowerCase()
const hubWalletAddress = process.env.REACT_APP_HUB_WALLET_ADDRESS.toLowerCase()
const channelManagerAddress = process.env.REACT_APP_CHANNEL_MANAGER_ADDRESS.toLowerCase()

const HASH_PREAMBLE = 'SpankWallet authentication message:'

const opts = {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': 'Bearer foo'
  },
  withCredentials: true
}

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
      depositVal: {
        amountWei: "1000",
        amountToken: "0"
      },
      exchangeVal: "100",
      paymentVal: {
        meta: {
          purchaseId: "payment"
        },
        payments: [
          {
            recipient: "0x0",
            amount: {
              amountWei: "0",
              amountToken: "100"
            }
          }
        ]
      },
      withdrawalVal: {
        withdrawalWeiUser: "100",
        tokensToSell: "0",
        withdrawalTokenUser: "0",
        weiToSell: "0",
        exchangeRate: "0.00",
        recipient: "0x0"
      },
      authorized: "false",
      web3: null,
      wallet: null,
      address: null,
      balance: 0,
      tokenBalance: 0,
      toggleKey: false,
      walletSet: false,
      keyEntered: "",
      approvalWeiUser: "10000",
      recipient: hubWalletAddress,
      connext: null,
      channelState: null,
      exchangeRate: "0.00",
      tokenContract: null
    };
    this.toggleKey = this.toggleKey.bind(this);
  }

  async componentDidMount() {
    try {
      // New provider code
      const providerOpts = new ProviderOptions().approving();
      const provider = clientProvider(providerOpts);
      const web3 = new Web3(provider);
      await this.setState({ web3 });

      console.log("set up web3 successfully");

      // create wallet. TODO: maintain wallet or use some kind of auth instead of generating new one.
      // as is, if you don't write down the privkey in the store you can't recover the wallet
      const wallet = await this.walletHandler();
      console.log('wallet: ', wallet);
      web3.eth.sign = wallet.sign
      web3.eth.signTransaction = wallet.signTransaction
      await this.setState({ web3 });

      const newWallet = wallet

      // make sure wallet is linked to chain
      store.dispatch({
        type: "SET_WALLET",
        text: newWallet
      });

      this.setState({ wallet: store.getState()[0] }); //newWallet});

      console.log("Set up wallet:");
      console.log(store.getState()[0]);

      this.setState({
        tokenContract: new web3.eth.Contract(humanTokenAbi, tokenAddress)
      })
      console.log("Set up token contract");

      // get address
      const account = store.getState()[0];
      this.setState({ address: account.address });

      console.log(`instantiating connext with hub as: ${hubUrl}`);
      console.log(`web3 address : ${JSON.stringify(account.address)}`);
      console.log("Setting up connext...");

      // *** Instantiate the connext client ***
      const connext = getConnextClient({
        web3,
        hubAddress: hubWalletAddress, //"0xfb482f8f779fd96a857f1486471524808b97452d" ,
        hubUrl: hubUrl, //http://localhost:8080,
        contractAddress: channelManagerAddress, //"0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42",
        user: account.address.toLowerCase()
      });

      console.log("Successfully set up connext!");

      connext.start(); // start polling
      //console.log('Pollers started! Good morning :)')
      connext.on("onStateChange", state => {
        console.log("Connext state changed:", state);
        this.setState({
          channelState: state.persistent.channel
        });
      });

      this.setState({ connext: connext });
      console.log(`This is state: ${JSON.stringify(this.state.channelState, null, 2)}`);
      await this.refreshBalances();
      this.pollExchangeRate();
    } catch (error) {
      alert(`Failed to load web3 or Connext. Check console for details.`);
      console.log(error);
    }
  }

  async pollExchangeRate() {
    const getRate = async () => {
      const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
      const json = await response.json()
      console.log('latest ETH->USD exchange rate: ', json.data.rates.USD);
      this.setState({
        exchangeRate: json.data.rates.USD
      })
    }
    getRate()
    setInterval(() => {
      getRate()
    }, 10000);
  }

  updateApprovalHandler(evt) {
    this.setState({
      approvalWeiUser: evt.target.value
    });
  }

  async updateDepositHandler(evt, token) {
    var value = evt.target.value;
    if (token === "ETH") {
      await this.setState(oldState => {
        oldState.depositVal.amountWei = value;
        return oldState;
      });
    } else if (token === "TST") {
      await this.setState(oldState => {
        oldState.depositVal.amountToken = value;
        return oldState;
      });
    }
    //console.log(`Updated depositVal: ${JSON.stringify(this.state.depositVal,null,2)}`)
  }

  async updateExchangeHandler(evt) {
    var value = evt.target.value;
    await this.setState(oldState => {
      oldState.exchangeVal = value;
      return oldState;
    });
    console.log(`Updated exchangeVal: ${JSON.stringify(this.state.exchangeVal, null, 2)}`);
  }

  async updateWithdrawHandler(evt, token) {
    var value = evt.target.value;
    if (token === "ETH") {
      await this.setState(oldState => {
        oldState.withdrawalVal.withdrawalWeiUser = value;
        return oldState;
      });
    } else if (token === "TST") {
      await this.setState(oldState => {
        oldState.withdrawalVal.tokensToSell = value;
        return oldState;
      });
    } else if (token === "recipient") {
      await this.setState(oldState => {
        oldState.withdrawalVal.recipient = value;
        return oldState;
      });
    }
    console.log(`Updated withdrawalVal: ${JSON.stringify(this.state.withdrawalVal, null, 2)}`);
  }

  async updatePaymentHandler(evt, token) {
    var value = evt.target.value;
    if (token === "ETH") {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountWei = value;
        return oldState;
      });
    } else if (token === "TST") {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountToken = value;
        return oldState;
      });
    } else if (token === "recipient") {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].recipient = value;
        return oldState;
      });
    }
    console.log(`Updated paymentVal: ${JSON.stringify(this.state.paymentVal, null, 2)}`);
  }

  async approvalHandler(evt) {
    // const tokenContract = this.state.tokenContract
    // let approveFor = channelManagerAddress;
    // let toApprove = this.state.approvalWeiUser;
    // let toApproveBn = eth.utils.bigNumberify(toApprove);
    // let depositResGas = await tokenSigner.estimate.approve(approveFor, toApproveBn);
    // console.log(`I predict this tx [a ${typeof tokenSigner.approve}] will require ${depositResGas} gas`);
    // let approveTx = await tokenSigner.functions.approve(approveFor, toApproveBn, { gasLimit: depositResGas });
    // console.log(approveTx);
  }

  //Connext Helpers
  async depositHandler() {
    const tokenContract = this.state.tokenContract
    let approveFor = channelManagerAddress;
    let approveTx = await tokenContract.methods.approve(approveFor, this.state.depositVal);
    console.log(approveTx);

    console.log(`Depositing: ${JSON.stringify(this.state.depositVal, null, 2)}`);
    let depositRes = await this.state.connext.deposit(this.state.depositVal);
    console.log(`Deposit Result: ${JSON.stringify(depositRes, null, 2)}`);
  }

  async exchangeHandler() {
    console.log(`Exchanging: ${JSON.stringify(this.state.exchangeVal, null, 2)}`);
    let exchangeRes = await this.state.connext.exchange(this.state.exchangeVal, "wei");
    console.log(`Exchange Result: ${JSON.stringify(exchangeRes, null, 2)}`);
  }

  async paymentHandler() {
    console.log(`Submitting payment: ${JSON.stringify(this.state.paymentVal, null, 2)}`);
    let paymentRes = await this.state.connext.buy(this.state.paymentVal);
    console.log(`Payment result: ${JSON.stringify(paymentRes, null, 2)}`);
  }

  async withdrawalHandler(max) {
    let withdrawalVal = { ...this.state.withdrawalVal, exchangeRate: this.state.exchangeRate }
    if (max) {
      withdrawalVal.tokensToSell = this.state.channelState.balanceTokenUser
      withdrawalVal.withdrawalWeiUser = this.state.channelState.balanceWeiUser
    }
    console.log(`Withdrawing: ${JSON.stringify(this.state.withdrawalVal, null, 2)}`);
    let withdrawalRes = await this.state.connext.withdraw(withdrawalVal);
    console.log(`Withdrawal result: ${JSON.stringify(withdrawalRes, null, 2)}`);
  }

  async collateralHandler() {
    console.log(`Requesting Collateral`);
    let collateralRes = await this.state.connext.requestCollateral();
    console.log(`Collateral result: ${JSON.stringify(collateralRes, null, 2)}`);
  }

  // Other Helpers
  getKey() {
    console.log(store.getState()[0]);
    function _innerGetKey() {
      const key = store.getState()[0].mnemonic;
      return key;
    }
    let privKey = _innerGetKey();
    return privKey;
  }

  toggleKey(evt) {
    evt.preventDefault();
    this.setState(prevState => ({ toggleKey: !prevState.toggleKey }), () => { });
  }

  // WalletHandler - it works but i'm running into some lifecycle issues. for option for user
  // to create wallet from privkey to display,
  // wallet creation needs to be in componentDidUpdate. but everything goes haywire when that happens so idk

  async walletHandler() {
    let wallet;
    let key = this.state.keyEntered;
    if (key) wallet = createWalletFromKey(key);
    else {
      wallet = await findOrCreateWallet(this.state.web3);
    }
    this.setState({ walletSet: true });
    return wallet;
  }

  updateWalletHandler(evt) {
    this.setState({
      keyEntered: evt.target.value
    });
    console.log(`Updating state : ${this.state.depositVal}`);
  }

  createWallet() {
    createWallet();
    window.location.reload(true);
  }

  async authorizeHandler(evt) {
    console.log(this.state.wallet);
    let res = await axios.post(`${hubUrl}/auth/challenge`, {}, opts);
    let hash = eth.utils.id(`${HASH_PREAMBLE} ${eth.utils.id(res.data.nonce)} ${eth.utils.id("localhost")}`);
    let signature = await this.state.web3.eth.sign(hash);
    try {
      let authRes = await axios.post(
        `${hubUrl}/auth/response`,
        {
          nonce: res.data.nonce,
          address: this.state.address,
          origin: "localhost",
          signature: signature.signature
        },
        opts
      );
      const token = authRes.data.token;
      document.cookie = `hub.sid=${token}`;
      console.log(`cookie set: ${token}`);
      res = await axios.get(`${hubUrl}/auth/status`, opts);
      if (res.data.success) {
        this.setState({ authorized: "true" });
      } else {
        this.setState({ authorized: "false" });
      }
      console.log(`Auth status: ${JSON.stringify(res.data)}`);
    } catch (e) {
      console.log(e);
    }
  }

  // to get tokens from metamask to browser wallet
  async getTokens() {
    let web3 = window.web3;
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
    const metamask = metamaskProvider.getSigner();
    const address = (await metamask.provider.listAccounts())[0];
    if (!address) {
      alert("You need to install & unlock metamask to do that");
      return;
    }

    const tokenContract = new eth.Contract(tokenAddress, humanTokenAbi, metamaskProvider);
    const token = tokenContract.connect(metamask);

    let tokens = eth.utils.bigNumberify("1000000000000000000");
    console.log(`Sending ${tokens} tokens to ${this.state.address}`);
    let approveTx = await token.functions.transfer(this.state.address, tokens);
    console.log(approveTx);
  }

  // to get tokens from metamask to browser wallet
  async getEther() {
    let web3 = await window.web3;
    if (!web3) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
    const metamask = metamaskProvider.getSigner();
    const address = (await metamask.provider.listAccounts())[0];
    if (!address) {
      alert("You need to install & unlock metamask to do that");
      return;
    }
    console.log('***** getEther *****')
    console.log(store.getState())
    console.log('web3:', web3)
    const sentTx = await metamask.sendTransaction({
      to: store.getState()[0].address,
      value: eth.utils.bigNumberify("1000000000000000000"),
      gasLimit: eth.utils.bigNumberify("21000")
    });
    console.log(sentTx);
  }

  // ** wrapper for ethers getBalance. probably breaks for tokens
  async refreshBalances() {
    const tokenContract = this.state.tokenContract
    const balance = Number(await this.state.web3.eth.getBalance(this.state.address)) / 1000000000000000000;
    const tokenBalance = Number(await tokenContract.methods.balanceOf(this.state.address).call()) / 1000000000000000000;
    this.setState({ balance: balance, tokenBalance: tokenBalance });

    const hubBalance = Number(await this.state.web3.eth.getBalance(hubWalletAddress)) / 1000000000000000000;
    const hubTokenBalance = Number(await tokenContract.methods.balanceOf(hubWalletAddress).call()) / 1000000000000000000;
    this.setState({
      hubWallet: {
        address: hubWalletAddress,
        balance: hubBalance,
        tokenBalance: hubTokenBalance
      }
    });

    const cmBalance = Number(await this.state.web3.eth.getBalance(channelManagerAddress)) / 1000000000000000000;
    const cmTokenBalance = Number(await tokenContract.methods.balanceOf(channelManagerAddress).call()) / 1000000000000000000;
    this.setState({
      channelManager: {
        address: channelManagerAddress,
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
    const mmBalance = Number(await this.state.web3.eth.getBalance(address)) / 1000000000000000000;
    const mmTokenBalance = Number(await tokenContract.methods.balanceOf(address).call()) / 1000000000000000000;
    this.setState({
      metamask: {
        address: address,
        balance: mmBalance,
        tokenBalance: mmTokenBalance
      }
    });
  }

  render() {
    return (
      <div className="app">
        <h1> Connext Starter Kit</h1>
        <div className="col">
          <div>
            <h1>Payment UX</h1>
            <h2>Deposit</h2>
            <button className="btn" onClick={evt => this.authorizeHandler(evt)}>
              Authorize
            </button>
            <span>&nbsp;&nbsp;(authorized: {this.state.authorized})</span>
            <br /> <br />
            <button className="btn" onClick={evt => this.getTokens(evt)}>
              Get 1 Token from Metamask
            </button>
            <button className="btn" onClick={evt => this.getEther(evt)}>
              Get 1 Ether from Metamask
            </button>
            <br /> <br />
            <div>
              <div className="value-entry">
                Enter approval amount in Wei:&nbsp;&nbsp;
                <input defaultValue={10000} onChange={evt => this.updateApprovalHandler(evt)} />
              </div>
              <button className="btn" onClick={evt => this.approvalHandler(evt)}>
                Approve Channel Manager
              </button>{" "}
              &nbsp;
              <br /> <br />
            </div>
            <div>
              <div className="value-entry">
                Enter ETH deposit amount in Wei:&nbsp;&nbsp;
                <input defaultValue={1000} onChange={evt => this.updateDepositHandler(evt, "ETH")} />
              </div>
              <div className="value-entry">
                Enter TST deposit amount in Wei:&nbsp;&nbsp;
                <input defaultValue={0} onChange={evt => this.updateDepositHandler(evt, "TST")} />
              </div>
              <button className="btn" onClick={evt => this.depositHandler(evt)}>
                Deposit to Channel
              </button>{" "}
              &nbsp;
              <br /> <br />
            </div>
            <div>
              <h2>Exchange</h2>
              <p>Exchanges will be made in-channel. Currently only ETH->Token exchanges are supported.</p>
              <div className="value-entry">
                Enter ETH exchange amount in Wei:&nbsp;&nbsp;
                <input defaultValue={100} onChange={evt => this.updateExchangeHandler(evt)} />
              </div>
              <button className="btn" onClick={evt => this.exchangeHandler(evt)}>
                Make an Exchange
              </button>{" "}
              &nbsp;
              <br /> <br />
            </div>
            <div>
              <h2>Payment</h2>
              <div className="value-entry">
                Enter recipient address:&nbsp;&nbsp;
                <input defaultValue={`0x...`} onChange={evt => this.updatePaymentHandler(evt, "recipient")} />
              </div>
              <div className="value-entry">
                Enter ETH payment amount in Wei:&nbsp;&nbsp;
                <input defaultValue={0} onChange={evt => this.updatePaymentHandler(evt, "ETH")} />
              </div>
              <div className="value-entry">
                Enter TST payment amount in Wei:&nbsp;&nbsp;
                <input defaultValue={100} onChange={evt => this.updatePaymentHandler(evt, "TST")} />
              </div>
              <button className="btn" onClick={evt => this.paymentHandler(evt)}>
                Make a Payment
              </button>{" "}
              &nbsp;
              <button className="btn" onClick={evt => this.collateralHandler(evt)}>
                Request Collateral
              </button>{" "}
              &nbsp;
              <br /> <br />
            </div>
            <div>
              <h2>Withdrawal</h2>
              <div className="value-entry">
                Enter recipient address:&nbsp;&nbsp;
                <input defaultValue={`0x...`} onChange={evt => this.updateWithdrawHandler(evt, "recipient")} />
              </div>
              <div className="value-entry">
                Enter ETH withdrawal amount in Wei:&nbsp;&nbsp;
                <input defaultValue={100} onChange={evt => this.updateWithdrawHandler(evt, "ETH")} />
              </div>
              <div className="value-entry">
                Enter TST withdrawal amount in Wei:&nbsp;&nbsp;
                <input defaultValue={0} onChange={evt => this.updateWithdrawHandler(evt, "TST")} />
              </div>
              <button className="btn" onClick={() => this.withdrawalHandler()}>
                Withdraw from Channel
              </button>{" "}
              &nbsp;
              <button className="btn" onClick={() => this.withdrawalHandler(true)}>
                Withdraw Max from Channel
              </button>{" "}
              &nbsp;
              <br /> <br />
            </div>
          </div>
        </div>
        <div className="col">
          <h1>Channel Information</h1>
          <p>Token Address: {tokenAddress}</p>
          Channel Balances:
          <br />
          User Wei Balance: {this.state.channelState ? this.state.channelState.balanceWeiUser : null}
          <br />
          User Token Balance: {this.state.channelState ? this.state.channelState.balanceTokenUser : null}
          <br />
          Hub Wei Balance: {this.state.channelState ? this.state.channelState.balanceWeiHub : null}
          <br />
          Hub Token Balance: {this.state.channelState ? this.state.channelState.balanceTokenHub : null}
        </div>
        <div className="col">
          <h1>Interesting Accounts</h1>
          <button className="btn" onClick={() => this.refreshBalances()}>
            Refresh balances
          </button>

          {this.state.walletSet ? (
            <div>
              <h2>Browser Wallet</h2>
              <p>Address: {this.state.address}</p>
              <p>ETH Balance: {this.state.balance}</p>
              <p>TST Balance: {this.state.tokenBalance}</p>
              <p>
                <button className="btn" onClick={this.toggleKey}>
                  {this.state.toggleKey ? <span>Hide Mnemonic</span> : <span>Reveal Mnemonic</span>}
                </button>
                {this.state.toggleKey ? <span>{this.getKey()}</span> : null}
              </p>
              <button className="btn" onClick={this.createWallet}>
                Create New Wallet
              </button>
            </div>
          ) : (
              <div>
                Enter your private key. If you do not have a wallet, leave blank and we'll create one for you.
              <div>
                  <input defaultValue={""} onChange={evt => this.updateWalletHandler(evt)} />
                </div>
                <button className="btn">Get wallet</button>
              </div>
            )}

          <h2>Channel Manager</h2>
          <p>Address: {this.state.channelManager.address}</p>
          <p>ETH Balance: {this.state.channelManager.balance}</p>
          <p>TST Balance: {this.state.channelManager.tokenBalance}</p>

          <h2>Hub's Wallet</h2>
          <p>Address: {this.state.hubWallet.address}</p>
          <p>ETH Balance: {this.state.hubWallet.balance}</p>
          <p>TST Balance: {this.state.hubWallet.tokenBalance}</p>

          <h2>Metamask Wallet</h2>
          <p>Address: {this.state.metamask.address}</p>
          <p>ETH balance: {this.state.metamask.balance}</p>
          <p>TST balance: {this.state.metamask.tokenBalance}</p>
        </div>
      </div>
    );
  }
}

export default App;
