const crypto = require('crypto')
const fs = require('fs')
const eth = require('ethers')
const solc = require('solc')
const linker = require('solc/linker')
const ChannelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const TokenArtifacts = require('../build/contracts/Token.json')
const HumanStandardTokenArtifacts = require('../build/contracts/HumanStandardToken.json')
const ECToolsArtifacts = require('../build/contracts/ECTools.json')

console.log(`Migrations activated in env: ${JSON.stringify(process.env,null,2)}`)

const cwd = process.cwd()
let HOME
if (cwd.indexOf('indra') !== -1) {
  HOME = `${cwd.substring(0,cwd.indexOf('indra')+5)}/modules/contracts`
} else {
  HOME = '/root'
}
const addressesPath = `${HOME}/address-book.json`
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

  ////////////////////////////////////////
  // Deploy ECTools if needed

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
    await wallet.provider.waitForTransaction(ecTools.deployTransaction.hash)
    ecTools.codeHash = hash(await wallet.provider.getCode(ecTools.address))
    console.log(`ECTools deployed to address ${ecTools.address} with code hash ${ecTools.codeHash.substring(0,8)}... via transaction ${ecTools.deployTransaction.hash}`)
    addresses.ECTools.networks[netId] = { "address" : ecTools.address, "codeHash": ecTools.codeHash }
    ECToolsSavedAddress = ecTools.address
  }

  ////////////////////////////////////////
  // Deploy a new token if needed

  console.log(`\nChecking for a valid token`)

  const tstSupply = "1000000000000000000000000000"
  const tstName = "Test Token"
  const tstDecimals = "18"
  const tstSymbol = "TST"

  let tokenAddress
  try {
    tokenAddress = addresses.Token.networks[netId].address
    const tokenName = addresses.Token.networks[netId].name || 'unknown'
    console.log(`Found token address for ${tokenName} in our address book: ${tokenAddress}`)
  } catch (e) {
    console.log(`A token address has not been saved to our address book yet`)
    tokenAddress = undefined
  }

  // Has this address been deployed?
  let tokenCode
  if (tokenAddress) {
    tokenCode = await wallet.provider.getCode(ECToolsSavedAddress)
    if (tokenCode === "0x") {
      console.log(`A contract has not been deployed to the provided token address`)
    }
  }

  if ((!tokenCode || !tokenAddress) && netId === 4447) {
    console.log(`Deploying a new HumanStandardToken contract..`)

    const hsToken = await eth.ContractFactory.fromSolidity(HumanStandardTokenArtifacts).connect(wallet).deploy(
      tstSupply,
      tstName,
      tstDecimals,
      tstSymbol
    )
    await wallet.provider.waitForTransaction(hsToken.deployTransaction.hash)

    tokenAddress = hsToken.address
    console.log(`Success, deployed to address ${tokenAddress}`)
    addresses.Token.networks[netId] = { "address": tokenAddress, "name": tstSymbol.toLowerCase() }
  } else if (!tokenAddress) {
    console.error(`If we're not in dev-mode, then a token needs to already have been deployed & saved in our address book`)
    process.exit(1)
  }

  ////////////////////////////////////////
  // Deploy the ChannelManager if needed

  console.log(`\nChecking for a valid ChannelManager`)
  const challengePeriod = 600

  let ChannelManagerSavedAddress
  try {
    ChannelManagerSavedAddress = addresses.ChannelManager.networks[netId].address
    console.log(`Found ChannelManager address in our address book: ${ChannelManagerSavedAddress}`)
  } catch (e) {
    console.log(`An ChannelManager address has not been saved to our address book`)
    ChannelManagerSavedAddress = undefined
  }

  // TODO: Check to see if it's linked to the expected ECTools and Token contracts

  if (!ChannelManagerSavedAddress) {
  console.log(`deploying the ChannelManager with params: hub=${wallet.address} challengePeriod=${challengePeriod} token=${tokenAddress}`)
  const ChannelManagerBytecode = linker.linkBytecode(ChannelManagerArtifacts.bytecode, {
    'ECTools': ECToolsSavedAddress
  })
  const channelManager = await (new eth.ContractFactory(
    ChannelManagerArtifacts.abi,
    ChannelManagerBytecode,
    wallet
  )).deploy(wallet.address, challengePeriod, tokenAddress)
  const channelManagerAddress = channelManager.address
  addresses.ChannelManager.networks[netId] = { "address": channelManagerAddress }
  // TODO: Save ECTools/Token links to addressbook
  console.log(`Success, deployed ChannelManger to address ${channelManagerAddress}`)
  }

  ////////////////////////////////////////
  // Save Artifacts to Filesystem

  const oldAddresses = JSON.stringify(JSON.parse(fs.readFileSync(addressesPath, 'utf8')))
  const newAddresses = JSON.stringify(addresses)

  if (oldAddresses !== newAddresses) {

    console.log(`\nSaving updated migration artifacts..`)
    try {
      fs.unlinkSync(addressesPath)
      fs.writeFileSync(addressesPath, JSON.stringify(addresses,null,2))
      console.log(`Done!`)
    } catch (e) {
      console.log(`Error saving artifacts: ${e}`)
    }

  } else {
    console.log(`\nNo changes to artifacts. Done!`)

  }

})();
