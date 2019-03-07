const EC = artifacts.require("./ECTools.sol");
const CM = artifacts.require("./ChannelManager.sol");
const HumanStandardToken = artifacts.require("./HumanStandardToken.sol");

module.exports = async function(deployer, network, accounts) {

  let ECTools = await EC.deployed();

  let tokenAddress = "0x0000000000000000000000000000000000000000";

  if (network === "ropsten") {
    // Use ropsten WETH for staging
    tokenAddress = "0xc778417E063141139Fce010982780140Aa0cD5Ab";

  } else if (network === "mainnet") {
    // Use DAI (or change it to BOOTY) on mainnet
    tokenAddress = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359";

  } else {
    // Use HumanStandardToken for private testnets
    const hst = await HumanStandardToken.deployed();
    tokenAddress = hst.address;
  }

  console.log(`Using token: ${tokenAddress}`)
  await deployer.link(EC, CM);
  await deployer.deploy(CM, accounts[0], 100000, tokenAddress);
};
