const Migrations = artifacts.require("./Migrations.sol");

console.log(`Migration step 1 activated!`)

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
