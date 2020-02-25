#!/bin/bash
set -e

recipient="$1"

node <<EOF
  const eth = require('ethers');
  const recipient = "$recipient";
  if (!eth.utils.isHexString(recipient) || eth.utils.arrayify(recipient).length !== 20) {
    console.log("Invalid address:", recipient)
    process.exit(1);
  }
  const mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
  const provider = new eth.providers.JsonRpcProvider("http://localhost:8545");
  const wallet = eth.Wallet.fromMnemonic(mnemonic).connect(provider);
  wallet.sendTransaction({ to: recipient, value: eth.utils.parseEther("0.05") }).then(console.log);
EOF
