import { store } from "./App";
import * as ethers from "ethers";

export async function createWallet(web3) {
  console.log("Creating new random wallet");
  let wallet = await web3.eth.accounts.create()
  // localStorage.setItem("mnemonic", wallet.signingKey.mnemonic);
  localStorage.setItem("privateKey", wallet.privateKey);
  return wallet
}

export async function findOrCreateWallet(web3) {
  let privateKey = localStorage.getItem("privateKey");
  let wallet;
  if (privateKey) {
    console.log("found existing wallet");
    wallet = web3.eth.accounts.privateKeyToAccount(privateKey)
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
