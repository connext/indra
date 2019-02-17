const crypto = require('crypto')
const fs = require('fs')
const eth = require('ethers')
const solc = require('solc')
const ChannelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const TokenArtifacts = require('../build/contracts/Token.json')
const ECToolsArtifacts = require('../build/contracts/ECTools.json')

const cwd = process.cwd()
const HOME = `${cwd.substring(0,cwd.indexOf('indra')+5)}/modules/contracts`
const addressesPath = `${HOME}/ops/addresses.json`
const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))

const hash = (message) => {
  return crypto.createHash('sha256').update(message).digest('hex')
}

const getWallet = (network) => {
  let provider
  if (process.env.ETH_PROVIDER) {
    console.log(`Connecting to provider ${process.env.ETH_PROVIDER}`)
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    console.log(`Connecting to infura`)
    provider = new eth.providers.InfuraProvider(network, process.env.INFURA_KEY)
  } else {
    console.log(`Connecting to default provider`)
    provider = eth.providers.getDefaultProvider(network)
  }

  let signer
  if (process.env.PRIVATE_KEY_FILE) {
    console.log(`Using private key to sign`)
    signer = new eth.Wallet(fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8'))
  } else if (process.env.ETH_MNEMONIC) {
    console.log(`Using mnemonic to sign`)
    signer = eth.Wallet.fromMnemonic(process.env.ETH_MNEMONIC)
  } else {
    console.error(`Couldn't setup signer: no private key or mnemonic found`)
    process.exit(1)
  }
  return signer.connect(provider)
}

////////////////////////////////////////
// Execute Migrations Script

;(async function() {

  const wallet = getWallet('ganache')

  const balance = await wallet.getBalance()
  const nonce = await wallet.getTransactionCount()
  const netId = (await wallet.provider.getNetwork()).chainId

  console.log(`Configured wallet with address=${wallet.address} nonce=${nonce} balance=${balance}`)
  console.log(`Connected to network: ${netId}`)

  console.log(`\nChecking for ECTools..`)

  let ECToolsSavedAddress
  try {
    ECToolsSavedAddress = addresses.ECTools.networks[netId].address
    console.log(`Found ECTools address in our address book: ${ECToolsSavedAddress}`)
  } catch (e) {
    console.log(`An ECTools address has not been saved to our address book`)
    ECToolsSavedAddress = undefined
  }

  let ECToolsSavedCodeHash
  try {
    ECToolsSavedCodeHash = addresses.ECTools.networks[netId].codeHash
  } catch (e) {
    console.log(`An ECTools code hash has not been saved to our address book`)
    ECToolsSavedCodeHash = undefined
  }

  let ECToolsCodeMatches = false
  if (ECToolsSavedAddress && ECToolsSavedCodeHash) {
    const ECToolsDeployedCodeHash = hash(await wallet.provider.getCode(ECToolsSavedAddress))
    if (ECToolsDeployedCodeHash === hash("0x")) {
      console.log(`ECTools doesn't appear to have been deployed to saved address..`)
    } else if (ECToolsDeployedCodeHash !== ECToolsSavedCodeHash) {
      console.log(`Deployed ECTools has different bytecode (hash=${ECToolsDeployedCodeHash.substring(0,8)}...) than what's saved (hash=${ECToolsSavedCodeHash.substring(0,8)}...)`)
    } else {
      console.log(`ECTools has been deployed and the bytecode matches what we expected, no action required`)
      ECToolsCodeMatches = true
    }
  }

  if (!ECToolsSavedAddress || !ECToolsCodeMatches) {
    console.log(`Deploying a new ECTools contract..`)
    const ecTools = await eth.ContractFactory.fromSolidity(ECToolsArtifacts).connect(wallet).deploy()
    ecTools.codeHash = hash(await wallet.provider.getCode(ecTools.address))
    console.log(`ECTools deployed to address ${ecTools.address} with code hash ${ecTools.codeHash.substring(0,8)}... via transaction ${ecTools.deployTransaction.hash}`)
    addresses.ECTools.networks[netId] = { "address" : ecTools.address, "codeHash": ecTools.codeHash }
  }

/* TODO: how should we handle linkages?
  console.log(`deploying the ChannelManager`)
  let channelManager = await ChannelManagerFactory.deploy()
  console.log(`deployed the ChannelManager, got: ${Object.keys(channelManager)}`)
*/

  ////////////////////////////////////////
  // Save Artifacts to Filesystem

  const oldAddresses = JSON.stringify(JSON.parse(fs.readFileSync(addressesPath, 'utf8')))
  const newAddresses = JSON.stringify(addresses)

  if (oldAddresses !== newAddresses) {

    console.log(`\nSaving updated migration artifacts..`)
    try {
      fs.unlinkSync(addressesPath)
      fs.writeFileSync(addressesPath, JSON.stringify(addresses,null,2))
    } catch (e) {
      console.log(`Error saving artifacts: ${e}`)
    }

  } else {
    console.log(`\nNo changes to artifacts..`)

  }

  console.log(`verifying code hash..`)
  const addressesReloaded = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))
  const codeHashReloaded = hash(await wallet.provider.getCode(addressesReloaded.ECTools.networks[netId].address))
  console.log(`Saved code hash: ${addressesReloaded.ECTools.networks[netId].codeHash.substring(0,8)} and deployed code hash: ${codeHashReloaded.substring(0,8)}`)


})();
