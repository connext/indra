const fs = require('fs')
const eth = require('ethers')
const ChannelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const TokenArtifacts = require('../build/contracts/Token.json')
const ECToolsArtifacts = require('../build/contracts/ECTools.json')

const getWallet = async (network) => {
  let provider
  if (process.env.ETH_PROVIDER) {
    console.error(`Connecting to provider ${process.env.ETH_PROVIDER}`)
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    console.error(`Connecting to infura`)
    provider = new eth.providers.InfuraProvider(network, process.env.INFURA_KEY)
  } else {
    console.error(`Connecting to default provider`)
    provider = eth.providers.getDefaultProvider(network)
  }

  let signer
  if (process.env.PRIVATE_KEY_FILE) {
    console.error(`Using private key to sign`)
    signer = new eth.Wallet(fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8'))
  } else if (process.env.ETH_MNEMONIC) {
    console.error(`Using mnemonic to sign`)
    signer = eth.Wallet.fromMnemonic(process.env.ETH_MNEMONIC)
  } else {
    console.error(`Couldn't setup signer: no private key or mnemonic found`)
    process.exit(1)
  }
  const wallet = signer.connect(provider)
  console.log(`Created wallet..`)
  const nonce = await wallet.getTransactionCount()
  console.log(`Configured wallet with address ${wallet.address} and nonce ${nonce}`)
  return wallet
}

const wallet = getWallet('ganache')

const ECToolsFactory = new eth.ContractFactory(
  ECToolsArtifacts.abi,
  ECToolsArtifacts.bytecode,
  wallet
)

/*
const ChannelManagerFactory = new eth.ContractFactory(
  ChannelManagerArtifacts.abi,
  ChannelManagerArtifacts.bytecode,
  wallet
)
*/

;(async function() {

  // If we can't find an already deployed ECTools, then deploy a new one
  console.log(`Deploying ECTools...`)
  let ecTools = await ECToolsFactory.deploy()
  console.log(`ECTools deployed to address: ${ecTools.address}`)

/* TODO: how to handle 
  console.log(`deploying the ChannelManager`)
  let channelManager = await ChannelManagerFactory.deploy()
  console.log(`deployed the ChannelManager, got: ${Object.keys(channelManager)}`)
*/

})();
