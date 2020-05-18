#!/bin/bash
set -e

recipient="$1"

node <<EOF
  const { utils, providers, Wallet } = require('ethers');
  const { isHexString, arrayify, parseEther } = utils;
  const recipient = "$recipient";
  if (!isHexString(recipient) || arrayify(recipient).length !== 20) {
    console.log("Invalid address:", recipient)
    process.exit(1);
  }
  const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = Wallet.fromMnemonic(mnemonic).connect(provider);
  wallet.sendTransaction({ to: recipient, value: parseEther("0.05") }).then(console.log);
EOF
