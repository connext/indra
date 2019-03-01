const EC = artifacts.require("./ECTools.sol");
const CM = artifacts.require("./ChannelManager.sol");
const HumanStandardToken = artifacts.require("./HumanStandardToken.sol");

// TODO: TEST ALL THIS, ESP ECTOOLS STUFF, but we should definitely have it
module.exports = async function(deployer, network, accounts) {
  const data = require('../ops/data.json')

  let tokenAddress

  if (network === "mainnet") {
    // TODO change to BOOTY address for mainnet spanks
    tokenAddress = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // DAI

    // TODO: use deployed ECTools
    await deployer.deploy(EC);
    await deployer.link(EC, CM);
  } else if (network === "rinkeby" || network === "rinkebyLive") {
    tokenAddress = "0x0fbE13fcF9C8B33a5c20FA93160DED33D4dF702E" // Rinkeby contract

    // TODO: use deployed version of ECTools
    await deployer.deploy(EC);
    await deployer.link(EC, CM);
  } else {
    web3.utils.toBN(web3.utils.toWei("696969", "ether"));
    await deployer.deploy(
      HumanStandardToken,
      data.token.supply,
      data.token.name,
      data.token.decimals,
      data.token.symbol
    );
    const hst = await HumanStandardToken.deployed();
    tokenAddress = hst.address;

    await deployer.deploy(EC);
    await deployer.link(EC, CM);
  }

  await deployer.deploy(CM, accounts[0], data.channelManager.challengePeriod, tokenAddress);
};
