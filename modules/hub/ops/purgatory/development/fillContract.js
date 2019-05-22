const ChannelManager = artifacts.require('./data/contracts/ChannelManager')
const HumanStandardToken = artifacts.require('./data/contracts/HumanStandardToken')

module.exports = callback => {
  async function run() {
    const cm = await ChannelManager.deployed()
    const hst = await HumanStandardToken.deployed()
    const acct = await web3.eth.getAccounts()

    await web3.eth.sendTransaction({ to: cm.address, value: web3.utils.toWei('5'), from: acct[0] })
    let balance = await web3.eth.getBalance(cm.address)
    console.log('contract ETH balance: ', balance);
    await hst.transfer(cm.address, '1000000000000000000000')
    balance = await hst.balanceOf(cm.address)
    console.log('contract HST balance: ', balance);
  }

  run().then(() => {
    callback()
  })
}
