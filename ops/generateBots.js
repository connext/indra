const ethers = require("ethers");
const fs = require('fs');

function generateBots(number) {
  let obj = {}
  for (let i = 0; i < number; i++) {
    const mnemonic = ethers.Wallet.createRandom().mnemonic;
    const node = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const xpub = node.neuter().extendedKey;
    obj[i+1] = { mnemonic, xpub };
  }
  fs.writeFileSync("bots.json", JSON.stringify(obj, null, 2));
}

generateBots(process.argv[2])