const EC = artifacts.require("./ECTools.sol");
const CM = artifacts.require("./ChannelManager.sol");
const HumanStandardToken = artifacts.require("./HumanStandardToken.sol");

module.exports = async function(deployer, network, accounts) {

  if (network === "ropsten" || network === "mainnet") {
    return
  }

  // should only be executed in dev mode on
  const ChannelManager = await CM.deployed();
  const Token = await HumanStandardToken.deployed();

  await Token.approve(ChannelManager.address, web3.utils.toBN(web3.utils.toWei("7000", "ether")))
  await Token.transfer(ChannelManager.address, web3.utils.toBN(web3.utils.toWei("7000", "ether")))

  await web3.eth.sendTransaction({
    to: ChannelManager.address,
    value: web3.utils.toBN(web3.utils.toWei("10", "ether")),
    from: accounts[0]
  })

  console.log('Migration 4 complete')
};
