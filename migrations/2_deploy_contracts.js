var EC = artifacts.require("./ECTools.sol");
var CM = artifacts.require("./ChannelManager.sol");

module.exports = async function(deployer) {
  deployer.deploy(EC);
  deployer.link(EC, CM);
  deployer.deploy(CM);
};
