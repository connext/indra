import React, { Component } from 'react';
import { getConnextClient } from 'connext/dist/Connext';
import './App.css';
import ProviderOptions from './utils/ProviderOptions.ts';
import clientProvider from './utils/web3/clientProvider.ts'; 
import * as ethers from 'ethers';
import {setWallet} from './utils/actions.js';
import { createWallet,createWalletFromKey } from './walletGen';
import { createStore } from 'redux';
import axios from 'axios';
import Web3 from 'web3.js';
require('dotenv').config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require('./abi/humanToken.json')

console.log(`starting app in env: ${JSON.stringify(process.env,null,1)}`)
const hubUrl = process.env.REACT_APP_HUB_URL
const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL
const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS
const hubWalletAddress = process.env.REACT_APP_HUB_WALLET_ADDRESS
const channelManagerAddress = process.env.REACT_APP_CHANNEL_MANAGER_ADDRESS

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
      wallet:null,
      address:null,
      balance:0,
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
      console.log(providerOpts);
      const provider = clientProvider(providerOpts)
      console.log(provider);
      const web3 = new ethers.providers.Web3Provider(provider)
      this.setState({web3: web3});
      console.log(web3)
      console.log("debug1")

      // create wallet. TODO: maintain wallet or use some kind of auth instead of generating new one.
      // as is, if you don't write down the privkey in the store you can't recover the wallet

      const wallet = this.walletHandler() 
      console.log(store.getState()[0])

      // make sure wallet is linked to chain
      console.log(provider)
       const newWallet = wallet.connect(web3);
       store.dispatch({
        type: 'SET_WALLET',
        text: newWallet
      });
      this.setState({wallet: store.getState()[0]});//newWallet});

      tokenContract = new ethers.Contract(tokenAddress, humanTokenAbi, web3)
      tokenSigner = tokenContract.connect(newWallet)

      // get address
      const account = store.getState()[0].address;
      this.setState({address:account});
      console.log(
        `instantiating connext with hub as: ${hubUrl}`
      );
      console.log(
        `web3 address : ${JSON.stringify(account)}`
      );
      

      // *** Instantiate the connext client ***
      const connext = getConnextClient({
          wallet: newWallet,
          web3,
          hubAddress: hubWalletAddress, //"0xfb482f8f779fd96a857f1486471524808b97452d" ,
          hubUrl: hubUrl, //http://localhost:8080,
          contractAddress: channelManagerAddress, //"0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42",
          user: account
        })
      
     connext.start() // start polling
     //console.log('Pollers started! Good morning :)')
     connext.on('onStateChange', state => {
        console.log('Connext state changed:', state)
      })
      this.setState({connext: connext
      });

    } catch (error) {
      alert(
        `Failed to load web3 or Connext. Check console for details.`
      );
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
      let toApproveBn = ethers.utils.bigNumberify(toApprove)
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
      let hash = ethers.utils.id(`${HASH_PREAMBLE} ${ethers.utils.id(res.data.nonce)} ${ethers.utils.id('localhost')}`)
      let signature = await this.state.wallet.signMessage(ethers.utils.arrayify(hash));
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
      let web3
      if (!web3) {
        web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
      }
      const provider = new ethers.provider.Web3Provider(web3.currentProvider);
      const signer = provider.getSigner();

      let tokens = ethers.utils.bigNumberify('1000000000000000000')

      let depositResGas = await signer.estimate.approve(store.getState()[0].address, tokens)

      console.log(`I predict this tx [a ${typeof signer.transfer}] will require ${depositResGas} gas`)

      let approveTx = await signer.functions.transfer(store.getState()[0].address, tokens, {gasLimit: depositResGas})

      console.log(approveTx);
    }

    // ** wrapper for ethers getBalance. probably breaks for tokens
    async getBalance(){
        const balance_hex = await this.state.web3.getBalance(this.state.address)
        const balance_num = Number(balance_hex)
        const eth_balance = (balance_num / 1000000000000000000)
        console.log(eth_balance)
        this.setState({balance:eth_balance})
    }

  //TODO add send functionality
  // async sendTransactionToExternal() {

  // }


  render() {
    return (
    <div className="app">
        <h1 > Connext Starter Kit </h1>
        <div className="col">
          <div> 
            <h1>Payment UX</h1>
            <button className='btn' onClick={evt => this.authorizeHandler(evt)}>Authorize</button>
            <button className='btn' onClick={evt => this.checkAuthorizeHandler(evt)}>Check Authorization</button>
            <div className="value-entry">
              <input defaultValue={0} onChange={evt => this.updateApprovalHandler(evt)}/>
              Enter approval amount in Wei
            </div>
            <button className='btn' onClick={evt => this.approvalHandler(evt)}>Approve Channel Manager</button>
            <div className="value-entry">
              <input defaultValue={0} onChange={evt => this.updateDepositHandler(evt)}/>
              Enter deposit amount in Wei
            </div>
            <button className="btn" onClick={evt => this.depositHandler(evt)}>Deposit to Channel</button>
          <div className="value-entry">
              <input defaultValue={0} onChange={evt => this.updatePaymentHandler(evt)}/>
              Enter payment amount in Wei
            </div>
            <button className="btn" onClick={evt => this.paymentHandler(evt)}>Make a Payment</button>
          <div className="value-entry">
          <input defaultValue={0} onChange={evt => this.updateWithdrawHandler(evt)}/>
          Enter withdrawal amount in Wei
          </div>
          <button className="btn" onClick={evt => this.withdrawalHandler(evt)}>Withdraw from Channel</button>
        </div>
      </div>
      <div className="col">
        {this.state.walletSet? 
        <div>
          <h1>Wallet Information</h1>
          <p>
            Address: {this.state.address}
          </p>
          <p>
            Balance: {JSON.stringify(this.state.balance)} ETH
            <button className="btn" onClick={() => this.getBalance()}>Refresh balance</button>
          </p>
          <p>
            Token Address: {tokenAddress}
          </p>
          <p>
            Token Balance:
          </p>
            <button className="btn" onClick={() => this.getTokens()}>Transfer Tokens to browser wallet</button>
          <p>
            <button className="btn" onClick={this.toggleKey}>
              {this.state.toggleKey ? 
                <span>Hide Private Key</span>
                :
                <span>Reveal Private Key</span>
              }
              </button>
            {this.state.toggleKey ?
              <span>{this.getKey()}</span> : null
            }
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
        <h1>Connext Information</h1>
        {/* these are undefined for some reason. I don't know why. I'm mad. */}
          Channel Balances: 
          {/*User Wei Balance: {this.state.connext.store.persistent.channel.balanceWeiUser}
          User Token Balance: {this.state.connext.store.balanceWeiUser}
          Hub Wei Balance: {this.state.connext.store.balanceWeiHub}
          Hub Token Balance: {this.state.connext.store.balanceWeiHub} */}
      </div>
    </div>
    );
  }
}

export default App;
