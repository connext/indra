import React, { Component } from 'react';
import { getConnextClient } from 'connext/dist/Connext';
import './App.css';
import ProviderOptions from './utils/ProviderOptions.ts';
import clientProvider from './utils/web3/clientProvider.ts'; 
import * as eth from 'ethers';
import {setWallet} from './utils/actions.js';
import { createWallet,createWalletFromKey } from './walletGen';
import { createStore } from 'redux';
import axios from 'axios';
//import Web3 from 'web3';
require('dotenv').config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require('./abi/humanToken.json')

console.log(`starting app in env: ${JSON.stringify(process.env,null,1)}`)
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase()
const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()
const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS.toLowerCase()
const hubWalletAddress = process.env.REACT_APP_HUB_WALLET_ADDRESS.toLowerCase()
const channelManagerAddress = process.env.REACT_APP_CHANNEL_MANAGER_ADDRESS.toLowerCase()

const HASH_PREAMBLE = 'SpankWallet authentication message:'

let tokenContract
let tokenSigner

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
          tokenBalance: 0,
        },
        channelManager: {
          address: channelManagerAddress,
          balance: 0,
          tokenBalance: 0,
        },
        depositVal: {
          amountWei: '0',
          amountToken: '0'
        },
        paymentVal:{
          meta:{
            purchaseId: 'payment',
          },
          payments: {
            purchaseId: 'paymentTotal',
            meta: null,
            amount: {
                amountWei: '0',
                amountToken: '0'
            },
            payments: {
                recipient: '0x0',
                amount: {
                    amountWei: '0',
                    amountToken: '0'
                },
            meta: null
            }
          },
          withdrawalVal:{
            withdrawalWeiUser: '0',
            tokensToSell: '0', 
            withdrawalTokenUser: '0', 
            weiToSell: '0',
            recipient: '0x0', //likely wrong, will address soon
          },
          web3: null,
          wallet: null,
          address:null,
          balance: 0,
          tokenBalance: 0,
          toggleKey:false,
          walletSet:false,
          keyEntered:'',
          approvalWeiUser: '100',
          recipient: hubWalletAddress,
          connext:null,
        }
      }
      this.toggleKey = this.toggleKey.bind(this);
    }

  
  async componentDidMount(){
    try {

      // New provider code
      const providerOpts = new ProviderOptions().approving()
      const provider = clientProvider(providerOpts)
      const web3 = new eth.providers.Web3Provider(provider)
      await this.setState({ web3: web3 });

      console.log("set up web3 successfully")

      // create wallet. TODO: maintain wallet or use some kind of auth instead of generating new one.
      // as is, if you don't write down the privkey in the store you can't recover the wallet
      const wallet = this.walletHandler() 
      const newWallet = wallet.connect(web3);

      // make sure wallet is linked to chain
      store.dispatch({
        type: 'SET_WALLET',
        text: newWallet
      });

      this.setState({ wallet: store.getState()[0] });//newWallet});

      console.log("Set up new wallet:")
      console.log(store.getState()[0])

      // new new provider code
      const ethProvider = new eth.providers.JsonRpcProvider(providerUrl)
      const localWallet = wallet.connect(ethProvider)
      this.setState({ localWallet: localWallet })

      tokenContract = new eth.Contract(tokenAddress, humanTokenAbi, ethProvider)
      tokenSigner = tokenContract.connect(localWallet)
      console.log("Set up token contract")

      // get address
      const account = store.getState()[0].address;
      this.setState({address:account});

      console.log(`instantiating connext with hub as: ${hubUrl}`);
      console.log(`web3 address : ${JSON.stringify(account)}`);
      console.log("Setting up connext...")

      // *** Instantiate the connext client ***
      const connext = getConnextClient({
          wallet: newWallet,
          web3,
          hubAddress: hubWalletAddress, //"0xfb482f8f779fd96a857f1486471524808b97452d" ,
          hubUrl: hubUrl, //http://localhost:8080,
          contractAddress: channelManagerAddress, //"0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42",
          user: account
      })

      console.log("Successfully setting up connext!")

      connext.start() // start polling
      //console.log('Pollers started! Good morning :)')
      connext.on('onStateChange', state => {
        console.log('Connext state changed:', state)
      })

      this.setState({ connext: connext });
      await this.refreshBalances()

    } catch (error) {
      alert(`Failed to load web3 or Connext. Check console for details.`);
      console.log(error);
    }
    
  };

    updateDepositHandler(evt) {
      this.setState({
        depositVal: {
          amountWei: evt.target.value,
          amountToken: '0'
        }
      });
      console.log(`Updating state : ${this.state.depositVal}`)
    }

    updateWithdrawHandler(evt) {
      this.setState({
        withdrawalVal:{
          withdrawalWeiUser: '0',
          tokensToSell: '0', 
          withdrawalTokenUser: evt.target.value, 
          weiToSell: '0',
          recipient: '0x0', //likely wrong, will address soon
        }
      });
    }

    updateApprovalHandler(evt) {
      this.setState({
        approvalWeiUser: evt.target.value,
      });
    }

    updatePaymentHandler(evt) {
      this.setState({
        paymentVal:{
          meta: {},
          payments: [
            {
              amount: { amountToken: evt.target.value, amountWei: '0' },
              type: 'PT_CHANNEL',
              meta: {},
              recipient: '$$HUB$$', //0xB669b484f2c72D226463d9c75d9B9A871aE7904e
            },
          ],
        //   meta:{
        //     purchaseId: 'payment',
        //   },
        //   payments: {
        //     purchaseId: 'paymentTotal',
        //     meta: null,
        //     amount: {
        //         amountWei: evt.target.value,
        //         amountToken: '0'
        //     },
        //     payments: {
        //         recipient: '0x0',
        //         amount: {
        //             amountWei: '0',
        //             amountToken: '0'
        //         },
        //     meta: null
        //     }
        //   }
        // }
        }
      });
    }

    async approvalHandler(evt) {
      let approveFor = channelManagerAddress
      let toApprove = this.state.approvalWeiUser
      let toApproveBn = eth.utils.bigNumberify(toApprove)
      let depositResGas = await tokenSigner.estimate.approve(approveFor, toApproveBn)
      console.log(`I predict this tx [a ${typeof tokenSigner.approve}] will require ${depositResGas} gas`)
      let approveTx = await tokenSigner.functions.approve(approveFor, toApproveBn, {gasLimit: depositResGas})
      console.log(approveTx);
    }

    //Connext Helpers
    async depositHandler(evt) {
      console.log(this.state.connext);
      let depositRes = await this.state.connext.deposit(this.state.depositVal)
      console.log(`${JSON.stringify(depositRes)}`)
    }

    async paymentHandler(evt) {
      await this.state.connext.buy(this.state.paymentVal)
    }

    async withdrawalHandler(evt) {
      await this.state.connext.withdraw(this.state.withdrawalVal)
    };

    // Other Helpers
    getKey(){
      console.log(store.getState()[0])
      function _innerGetKey(){
        const key = store.getState()[0].privateKey;
        return key
      }
      let privKey = _innerGetKey();
      return privKey
    }

    toggleKey(evt){
      evt.preventDefault();
      this.setState(prevState => ({toggleKey: !prevState.toggleKey}), () => {
      });  
    }

    // WalletHandler - it works but i'm running into some lifecycle issues. for option for user
    // to create wallet from privkey to display, 
    // wallet creation needs to be in componentDidUpdate. but everything goes haywire when that happens so idk

    walletHandler(){
      let wallet
      let key = this.state.keyEntered;
      if(key)
        wallet = createWalletFromKey(key);
      else{
        wallet = createWallet()
      }
      this.setState({walletSet:true})
      return wallet
    }

    updateWalletHandler(evt) {
      this.setState({
        keyEntered:  evt.target.value,
      });
      console.log(`Updating state : ${this.state.depositVal}`)
    }

    async checkAuthorizeHandler(evt) {
      let res = await axios.get(`${hubUrl}/auth/status`, opts)
      console.log(`Auth status: ${JSON.stringify(res.data)}`)
    }

    async authorizeHandler(evt) {
      console.log(this.state.wallet)
      let res = await axios.post(`${hubUrl}/auth/challenge`, {}, opts)
      let hash = eth.utils.id(`${HASH_PREAMBLE} ${eth.utils.id(res.data.nonce)} ${eth.utils.id('localhost')}`)
      let signature = await this.state.wallet.signMessage(eth.utils.arrayify(hash));
      try {
        let authRes = await axios.post(`${hubUrl}/auth/response`, {
          nonce: res.data.nonce,
          address: this.state.wallet.address,
          origin: 'localhost',
          signature: signature
        }, opts)
        const token = authRes.data.token
        document.cookie = `hub.sid=${token}`
        console.log(`cookie set: ${token}`)
      } catch(e){
        console.log(e)
      }
      
    }

    // to get tokens from metamask to browser wallet
    async getTokens(){
      let web3 = window.web3
      if (!web3) {
        alert('You need to install & unlock metamask to do that')
        return
      }
      const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
      const metamask = metamaskProvider.getSigner();
      const address = (await metamask.provider.listAccounts())[0]
      if (!address) {
        alert('You need to install & unlock metamask to do that')
        return
      }

      const tokenContract = new eth.Contract(tokenAddress, humanTokenAbi, metamaskProvider)
      const token = tokenContract.connect(metamask)

      let tokens = eth.utils.bigNumberify('1000000000000000000')
      console.log(`Sending ${tokens} tokens to ${this.state.address}`)
      let approveTx = await token.functions.transfer(this.state.address, tokens)
      console.log(approveTx);
    }

    // to get tokens from metamask to browser wallet
    async getEther(){
      let web3 = window.web3
      if (!web3) {
        alert('You need to install & unlock metamask to do that')
        return
      }
      const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
      const metamask = metamaskProvider.getSigner();
      const address = (await metamask.provider.listAccounts())[0]
      if (!address) {
        alert('You need to install & unlock metamask to do that')
        return
      }
      const sentTx = await metamask.sendTransaction({
        to: this.state.localWallet.address,
        value: eth.utils.bigNumberify('1000000000000000000'),
        gasLimit: eth.utils.bigNumberify('21000'),
      })
      console.log(sentTx)
    }

    // ** wrapper for ethers getBalance. probably breaks for tokens
    async refreshBalances(){
      const balance = Number(await this.state.web3.getBalance(this.state.address)) / 1000000000000000000
      const tokenBalance = Number(await tokenContract.balanceOf(this.state.address)) / 1000000000000000000
      this.setState({ balance: balance, tokenBalance: tokenBalance })

      const hubBalance = Number(await this.state.web3.getBalance(hubWalletAddress)) / 1000000000000000000
      const hubTokenBalance = Number(await tokenContract.balanceOf(hubWalletAddress)) / 1000000000000000000
      this.setState({ hubWallet: {
        address: hubWalletAddress,
        balance: hubBalance,
        tokenBalance: hubTokenBalance
      }})

      const cmBalance = Number(await this.state.web3.getBalance(channelManagerAddress)) / 1000000000000000000
      const cmTokenBalance = Number(await tokenContract.balanceOf(channelManagerAddress)) / 1000000000000000000
      this.setState({ channelManager: {
        address: channelManagerAddress,
        balance: cmBalance,
        tokenBalance: cmTokenBalance
      }})

      let web3 = window.web3
      if (!web3) {
        alert('You need to install & unlock metamask to do that')
        return
      }
      const metamaskProvider = new eth.providers.Web3Provider(web3.currentProvider);
      const metamask = metamaskProvider.getSigner();
      const address = (await metamask.provider.listAccounts())[0]
      if (!address) {
        this.setState({ metamask: { address: 'unavailable', balance: 0, tokenBalance: 0 } })
        return
      }
      const mmBalance = Number(await this.state.web3.getBalance(address)) / 1000000000000000000
      const mmTokenBalance = Number(await tokenContract.balanceOf(address)) / 1000000000000000000
      this.setState({
        metamask: {
          address: address,
          balance: mmBalance,
          tokenBalance: mmTokenBalance
        }
      })
    }

  render() {
    return (
    <div className="app">
      <h1> Connext Starter Kit</h1>
      <div className="col">
        <div> 
          <h1>Payment UX</h1>
          <button className='btn' onClick={evt => this.authorizeHandler(evt)}>Authorize</button>
          <button className='btn' onClick={evt => this.checkAuthorizeHandler(evt)}>Check Authorization</button>
          <br/>
          <br/>
          <div className="value-entry">
            Enter approval amount in Wei <br/>
            <button className='btn' onClick={evt => this.approvalHandler(evt)}>Approve Channel Manager</button> &nbsp;
            <input defaultValue={0} onChange={evt => this.updateApprovalHandler(evt)}/>
          </div>
          <br/>
          <div className="value-entry">
            Enter deposit amount in Wei <br/>
            <button className="btn" onClick={evt => this.depositHandler(evt)}>Deposit to Channel</button> &nbsp;
            <input defaultValue={0} onChange={evt => this.updateDepositHandler(evt)}/>
          </div>
          <br/>
          <div className="value-entry">
            Enter payment amount in Wei <br/>
            <button className="btn" onClick={evt => this.paymentHandler(evt)}>Make a Payment</button> &nbsp;
            <input defaultValue={0} onChange={evt => this.updatePaymentHandler(evt)}/>
          </div>
          <br/>
          <div className="value-entry">
            Enter withdrawal amount in Wei <br/>
            <button className="btn" onClick={evt => this.withdrawalHandler(evt)}>Withdraw from Channel</button> &nbsp;
            <input defaultValue={0} onChange={evt => this.updateWithdrawHandler(evt)}/>
          </div>
        </div>
      </div>
      <div className="col">

        <h1>Channel Information</h1>
        <p>Token Address: {tokenAddress}</p>
        {/* these are undefined for some reason. I don't know why. I'm mad. */}
        Channel Balances: 
        {/*
        User Wei Balance: {this.state.connext.store.persistent.channel.balanceWeiUser}
        User Token Balance: {this.state.connext.store.balanceWeiUser}
        Hub Wei Balance: {this.state.connext.store.balanceWeiHub}
        Hub Token Balance: {this.state.connext.store.balanceWeiHub}
        */}

      </div>
      <div className="col">

        <h1>Interesting Accounts</h1>
        <button className="btn" onClick={() => this.refreshBalances()}>Refresh balances</button>

        {this.state.walletSet
          ?
          <div>
            <h2>Browser Wallet</h2>
            <button className='btn' onClick={evt => this.getTokens(evt)}>Get 1 Token from Metamask</button>
            <button className='btn' onClick={evt => this.getEther(evt)}>Get 1 Ether from Metamask</button>
            <p>Address: {this.state.address}</p>
            <p>ETH Balance: {this.state.balance}</p>
            <p>TST Balance: {this.state.tokenBalance}</p>
            <p>
              <button className="btn" onClick={this.toggleKey}>
                {this.state.toggleKey ?  <span>Hide Private Key</span> : <span>Reveal Private Key</span> }
              </button>
              {this.state.toggleKey ?  <span>{this.getKey()}</span> : null }
            </p>
          </div>
          :
          <div>
            Enter your private key. If you do not have a wallet, leave blank and we'll create one for you.
            <div>
            <input defaultValue={''} onChange={evt => this.updateWalletHandler(evt)}/>
            </div>
            <button className="btn">Get wallet</button>
          </div>
        }

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
