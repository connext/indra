const EC = artifacts.require("./ECTools.sol");
const CM = artifacts.require("./ChannelManager.sol");
const HumanStandardToken = artifacts.require("./HumanStandardToken.sol");

console.log(`Migration step 2 activated!`)

// TODO: TEST ALL THIS, ESP ECTOOLS STUFF, but we should definitely have it
module.exports = async function(deployer, network, accounts) {
  const data = require('../ops/data.json')
  const addresses = require('../ops/address-book.json')

  console.log(`web3.version= ${web3.version}`)
  const netid = await web3.eth.net.getId()
  console.log(`Attached to network id ${netid}`)

  let tokenAddress

  if (network === "mainnet") {
    // tokenAddress = addresses.Tokens.networks["1"].Booty
    tokenAddress = addresses.Tokens.networks["1"].Dai

    // TODO: use deployed ECTools
    await deployer.deploy(EC);
    await deployer.link(EC, CM);
  } else if (network === "rinkeby") {

    tokenAddress = addresses.Tokens.networks["4"].Weth

    tokenAddress = "0xc778417e063141139fce010982780140aa0cd5ab" // Rinkeby WETH

    // use deployed version of ECTools
    const deployedEC = await EC.at('0xf6B5eed0b9cC2948cBD95C788Db7457B54d80c44')
    await deployer.link(deployedEC, CM);
  } else if (network !== "mainnet" && network !== "rinkeby") {
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
