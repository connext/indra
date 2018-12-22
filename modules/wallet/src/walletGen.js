import { store } from './App';
import * as ethers from 'ethers';

export function createWallet(){
  //const mnemonic = localStorage.getItem('mnemonic')
  let mnemonic
  let wallet
  if (mnemonic) {
    console.log('found existing wallet')
    wallet = new ethers.Wallet.fromMnemonic(mnemonic)
  } else {
    wallet = new ethers.Wallet.createRandom()
    localStorage.setItem('mnemonic', wallet.signingKey.mnemonic)
  }
  console.log(wallet);
  store.dispatch({
      type: 'SET_WALLET',
      text: wallet //Buffer.from(String(privKey.private),'hex')
      });
  return wallet;
} 
export function createWalletFromKey(privKey){
    const wallet = new ethers.Wallet(privKey)
    console.log(wallet);
    store.dispatch({
        type: 'SET_WALLET',
        text: wallet //Buffer.from(String(privKey.private),'hex')
        });
    return wallet;
} 

export function getStore(){
  if(store){
    return store
  }else{
    console.log( "no store found")
  }
};

