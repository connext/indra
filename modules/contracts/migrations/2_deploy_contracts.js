const EC = artifacts.require("./ECTools.sol");
const CM = artifacts.require("./ChannelManager.sol");
const HumanStandardToken = artifacts.require("./HumanStandardToken.sol");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(EC);

  const data = require('../data.json')

  let tokenAddress

  if (network === "mainnet") {
    // TODO change to BOOTY address for mainnet spanks
    tokenAddress = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // DAI

  } else if (network === "rinkeby") {
    tokenAddress = "0xc778417e063141139fce010982780140aa0cd5ab" // Rinkeby WETH

  } else if (network !== "mainnet" && network !== "rinkeby") {
    const supply = web3.utils.toBN(web3.utils.toWei("696969", "ether"));
    await deployer.deploy(
      HumanStandardToken,
      data.token.supply,
      data.token.name,
      data.token.decimals,
      data.token.symbol
    );
    const hst = await HumanStandardToken.deployed();
    tokenAddress = hst.address;
  }

  await deployer.link(EC, CM);
  await deployer.deploy(CM, accounts[0], data.channelManager.challengePeriod, tokenAddress);
};
