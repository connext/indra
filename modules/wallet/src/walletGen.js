import { store } from "./App";
import * as ethers from "ethers";

export function createWallet() {
  console.log("Creating new random wallet");
  let wallet = new ethers.Wallet.createRandom();
  localStorage.setItem("mnemonic", wallet.signingKey.mnemonic);
}

export function findOrCreateWallet() {
  let mnemonic = localStorage.getItem("mnemonic");
  let wallet;
  if (mnemonic) {
    console.log("found existing wallet");
    wallet = new ethers.Wallet.fromMnemonic(mnemonic);
  } else {
    createWallet();
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
