import { store } from "./App";
import * as ethers from "ethers";

export async function createWallet(web3) {
  console.log("Creating new random wallet");
  let wallet = await web3.eth.accounts.create()
  // localStorage.setItem("mnemonic", wallet.signingKey.mnemonic);
  localStorage.setItem("wallet", wallet);
  return wallet
}

export async function findOrCreateWallet(web3) {
  let mnemonic = localStorage.getItem("mnemonic");
  let wallet;
  if (mnemonic && false) {
    console.log("found existing wallet");
    wallet = new ethers.Wallet.fromMnemonic(mnemonic);
  } else {
    wallet = await createWallet(web3);
  }
  store.dispatch({
    type: "SET_WALLET",
    text: wallet //Buffer.from(String(privKey.private),'hex')
  });
  return wallet;
}

export function createWalletFromKey(privKey) {
  const wallet = new ethers.Wallet(privKey);
  console.log(wallet);
  store.dispatch({
    type: "SET_WALLET",
    text: wallet //Buffer.from(String(privKey.private),'hex')
  });
  return wallet;
}

export function getStore() {
  if (store) {
    return store;
  } else {
    console.log("no store found");
  }
}
