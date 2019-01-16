import React, { Component } from 'react';
import { getConnextClient } from 'connext/dist/Connext';
import './App.css';
import ProviderOptions from './utils/ProviderOptions.ts';
import clientProvider from './utils/web3/clientProvider.ts';
import { setWallet } from './utils/actions.js';
import { createWallet, createWalletFromKey, findOrCreateWallet } from './walletGen';
import { createStore } from 'redux';
import Select from 'react-select';
import axios from 'axios';
import DepositCard from './components/depositCard';
import SwapCard from './components/swapCard';
import PayCard from './components/payCard';
import WithdrawCard from './components/withdrawCard';
import ChannelCard from './components/channelCard';
import FullWidthTabs from './components/walletTabs';
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const eth = require('ethers');
//const util = require('ethereumjs-util')
require('dotenv').config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require('./abi/humanToken.json')

console.log(`starting app in env: ${JSON.stringify(process.env, null, 1)}`)
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase()
//const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()
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
      selectedWallet: null,
      walletOptions: [],
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
      await this.setWalletAndProvider(false)
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

  walletChangeHandler = async (selectedWallet) => {
    this.setState({ selectedWallet, });
    if (selectedWallet.label === "Metamask") {
      await this.setWalletAndProvider(true)
    } else {
      await this.setWalletAndProvider(false)
    }

    await this.authorizeHandler();

    await this.setConnext()

    await this.refreshBalances()

    console.log(`Option selected:`, selectedWallet);
  }







  

  async approvalHandler(evt) {
    const web3 = this.state.web3
    const tokenContract = this.state.tokenContract
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
    })
    tx.sign(Buffer.from(this.state.wallet.privateKey.substring(2), 'hex'))
    let signedTx = '0x' + tx.serialize().toString('hex')
    let sentTx = web3.eth.sendSignedTransaction(signedTx, (err) => { if (err) console.error(err) })
    sentTx
      .once('transactionHash', (hash) => { console.log(`tx broadcasted, hash: ${hash}`) })
      .once('receipt', (receipt) => { console.log(`tx mined, receipt: ${JSON.stringify(receipt)}`) })
    console.log(`Sent tx: ${typeof sentTx} with keys ${Object.keys(sentTx)}`);
  }

  //Connext Helpers



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
    console.log(`privkey: ${JSON.stringify(privKey)}`)
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

  async createWallet() {
    await createWallet(this.state.web3);
    window.location.reload(true);
  }

  async authorizeHandler(evt) {
    const web3 = this.state.web3
    const challengeRes = await axios.post(`${hubUrl}/auth/challenge`, {}, opts);

    const hash = web3.utils.sha3(`${HASH_PREAMBLE} ${web3.utils.sha3(challengeRes.data.nonce)} ${web3.utils.sha3("localhost")}`)

    const signature = await web3.eth.personal.sign(hash, this.state.address)

    try {
      let authRes = await axios.post(
        `${hubUrl}/auth/response`,
        {
          nonce: challengeRes.data.nonce,
          address: this.state.address,
          origin: "localhost",
          signature,
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

  // to get tokens from metamask to browser wallet
  

  // ** wrapper for ethers getBalance. probably breaks for tokens

  render() {
    return (
      <div className="app">
        <div className="row" style={{justifyContent: 'center'}}>
          <img style={{height:'70px', width:'300px'}} src="https://connext.network/static/media/logoHorizontal.3251cc60.png" />
        </div>
        <div className="row">
          <div className="column">
           <ChannelCard 
              channelState={this.state.channelState}/>
          </div>
          <div className="column">
            <FullWidthTabs 
              metamask={this.state.metamask} 
              channelManager={this.state.channelManager}
              hubWallet={this.state.hubWallet} 
              web3={this.state.web3}
              tokenContract={this.state.tokenContract}/>
          </div>
        </div>
        <div className="row">
          <div className="column">
            <DepositCard
              channelManagerAddress={this.state.channelManager.address}
              Web3={window.web3}
              tokenContract={this.state.tokenContract}
              humanTokenAbi={humanTokenAbi}
              connext={this.state.connext}
              />
          </div>
          <div className="column">
            <SwapCard
              connext={this.state.connext}
              exchangeRate={this.state.exchangeRate}
              />
          </div>
          <div className="column">
            <PayCard
              connext={this.state.connext}
              />
          </div>
          <div className="column">
            <WithdrawCard
              connext={this.state.connext}
              exchangeRate={this.state.exchangeRate}
              />
          </div>         
        </div>
        <div className="row">
          <div className="column" style={{justifyContent:'flex-end !important'}}>
            Made with 💛 by the Connext Team
          </div>
        </div>
        
        {/* <div className="row">

          <div className="column">

            {this.state.walletSet ? (
              <div>
                <p>
                  <button className="btn" onClick={this.toggleKey}>
                    {this.state.toggleKey ? <span>Hide Browser Wallet Mnemonic</span> : <span>Reveal Browser Wallet Mnemonic</span>}
                  </button>
                  {this.state.toggleKey ? <span>{this.getKey()}</span> : null}
                </p>
                <button className="btn" onClick={() => this.createWallet()}>
                  Create New Browser Wallet
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
          </div>
      </div> */}
    </div>
    );
  }
}

export default App;
