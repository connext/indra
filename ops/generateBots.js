const eth = require("ethers");
const fs = require("fs");
const tokenArtifacts = require("openzeppelin-solidity/build/contracts/ERC20Mintable.json");

(async function(number, funderMnemonic, ethRpc, tokenAddress, botsFile) {
  // some basic sanity checks
  if (!number) { throw new Error("No number of bots to generate provided"); }
  if (!funderMnemonic) { throw new Error("No funder mnemonic provided"); }
  if (!ethRpc) { throw new Error("No eth rpc url provided"); }
  if (!tokenAddress) { throw new Error("No token address provided"); }
  if (!botsFile) { throw new Error("No bots filename provided"); }

  // make the funder account and wallet
  const ethGift = "0.1";
  const tokenGift = "1000";
  const cfPath = "m/44'/60'/0'/25446";
  const provider = new eth.providers.JsonRpcProvider(ethRpc);
  const funder = new eth.Wallet.fromMnemonic(funderMnemonic).connect(provider);
  const token = new eth.Contract(tokenAddress, tokenArtifacts.abi, funder);

  let obj = {};
  for (let i = 1; i <= number; i++) {
    const botMnemonic = eth.Wallet.createRandom().mnemonic;
    const hdNode = eth.utils.HDNode.fromMnemonic(botMnemonic).derivePath(cfPath);
    const xpub = hdNode.neuter().extendedKey;
    const addr = eth.Wallet.fromMnemonic(botMnemonic, cfPath).address;
    console.log(`Funding bot ${addr} with ${ethGift} eth and ${tokenGift} tokens`)
    const ethTx = await funder.sendTransaction({ to: addr, value: eth.utils.parseEther(ethGift) });
    await funder.provider.waitForTransaction(ethTx.hash);
    const tokenTx = await token.mint(addr, eth.utils.parseEther(tokenGift));
    await funder.provider.waitForTransaction(tokenTx.hash);
    obj[i] = { mnemonic: botMnemonic, xpub };
  }

  fs.writeFileSync(botsFile, JSON.stringify(obj, null, 2));
})(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6])
