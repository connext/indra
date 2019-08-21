const ethers = require("ethers");
const fs = require('fs');
const tokenArtifacts = require('openzeppelin-solidity/build/contracts/ERC20Mintable.json')


const generateBots = async (number, funderMnemonic, ethRpc, tokenAddress) => {
  console.log("Called with opts:")
  console.log("   - number", number)
  console.log("   - funderMnemonic", funderMnemonic)
  console.log("   - ethRpc", ethRpc)
  console.log("   - tokenAddress", tokenAddress)

  // some basic error handling
  if (!number) {
    throw new Error("No number of bots to generate provided");
  }
  if (!funderMnemonic) {
    throw new Error("No funder mnemonic provided");
  }
  if (!ethRpc) {
    throw new Error("No eth rpc url provided");
  }
  if (!tokenAddress) {
    throw new Error("No token address provided");
  }

  // make the funder account and wallet
  const ethGift = '3'
  const tokenGift = '1000000'
  const provider = new ethers.providers.JsonRpcProvider(ethRpc)
  const funder = new ethers.Wallet.fromMnemonic(funderMnemonic).connect(provider)
  const token = new ethers.Contract(tokenAddress, tokenArtifacts.abi, funder)

  let obj = {}
  for (let i = 0; i < number; i++) {
    const bot = ethers.Wallet.createRandom()
    
    // send eth
    console.log(`\nSending ${ethGift} eth to ${bot.address}`)
    const ethTx = await funder.sendTransaction({
      to: bot.address,
      value: ethers.utils.parseEther(ethGift)
    })
    await funder.provider.waitForTransaction(ethTx.hash)
    console.log(`Transaction mined! Hash: ${ethTx.hash}q`)

    // send tokens
    console.log(`Minting ${tokenGift} tokens for ${bot.address}`)
    const tokenTx = await token.mint(bot.address, ethers.utils.parseEther(tokenGift))
    await funder.provider.waitForTransaction(tokenTx.hash)
    console.log(`Transaction mined! Hash: ${tokenTx.hash}`)

    const node = ethers.utils.HDNode.fromMnemonic(bot.mnemonic);
    const xpub = node.neuter().extendedKey;
    obj[i+1] = { mnemonic: bot.mnemonic, xpub };
  }
  fs.writeFileSync("bots.json", JSON.stringify(obj, null, 2));
}

generateBots(process.argv[2], process.argv[3], process.argv[4], process.argv[5]).then(() => console.log("Completed"))