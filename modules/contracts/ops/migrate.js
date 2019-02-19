const crypto = require('crypto')
const fs = require('fs')
const eth = require('ethers')
const solc = require('solc')
const linker = require('solc/linker')
const ChannelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const TokenArtifacts = require('../build/contracts/Token.json')
const HumanStandardTokenArtifacts = require('../build/contracts/HumanStandardToken.json')
const ECToolsArtifacts = require('../build/contracts/ECTools.json')

//console.log(`Migrations activated in env: ${JSON.stringify(process.env,null,2)}`)

////////////////////////////////////////
// Environment Setup

const cwd = process.cwd()
let HOME
if (cwd.indexOf('indra') !== -1) {
  HOME = `${cwd.substring(0,cwd.indexOf('indra')+5)}/modules/contracts`
} else {
  HOME = '/root'
}
const addressesPath = `${HOME}/ops/address-book.json`
const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))

////////////////////////////////////////
// Helper Functions

const hash = (message) => {
  return crypto.createHash('sha256').update(message).digest('hex')
}

const getSavedData = (contractName, property, netId) => {
  let savedData
  try {
    return addresses[contractName].networks[netId][property]
  } catch (e) {
    return undefined
  }
}

////////////////////////////////////////
// Execute Migrations Script

;(async function() {

  // Setup signer & connect to eth provider

  let provider
  if (process.env.ETH_PROVIDER) {
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    provider = new eth.providers.InfuraProvider(network, process.env.INFURA_KEY)
  } else {
    provider = eth.providers.getDefaultProvider(network)
  }

  let signer
  if (process.env.PRIVATE_KEY_FILE) {
    signer = new eth.Wallet(fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8'))
  } else if (process.env.ETH_MNEMONIC) {
    signer = eth.Wallet.fromMnemonic(process.env.ETH_MNEMONIC)
  } else {
    console.error(`Couldn't setup signer: no private key or mnemonic found`)
    process.exit(1)
  }

  const wallet = signer.connect(provider)

  console.log(`\nPreparing to migrate contracts using account ${wallet.address} `)

  let balance, nonce, netId
  try {
    balance = await wallet.getBalance()
    nonce = await wallet.getTransactionCount()
    netId = (await wallet.provider.getNetwork()).chainId
  } catch (e) {
    console.error(`Couldn't connect to eth provider: ${JSON.stringify(provider,null,2)}`)
    process.exit(1)
  }

  console.log(`Connected to provider for network ${netId}, Wallet status: nonce=${nonce} balance=${balance}`)

  ////////////////////////////////////////
  // Deploy ECTools if needed

  console.log(`\nChecking ECTools contract..`)

  let shouldMigrateECTools = false
  let ECToolsAddress
  let ECToolsCompiledCodeHash
  let ECToolsDeployedCodeHash

  const ECToolsSavedAddress = getSavedData('ECTools', 'address', netId)
  if (!ECToolsSavedAddress) {
    console.log(`Couldn't find a saved address for ECTools.`)
    shouldMigrateECTools = true
  }

  const ECToolsSavedCompiledCodeHash = getSavedData('ECTools', 'compiledCodeHash', netId)
  ECToolsCompiledCodeHash = hash(ECToolsArtifacts.bytecode)
  if (!shouldMigrateECTools && ECToolsCompiledCodeHash !== ECToolsSavedCompiledCodeHash) {
    console.log(`Source code of ECTools code has been updated.`)
    shouldMigrateECTools = true
  }

  const ECToolsSavedDeployedCodeHash = getSavedData('ECTools', 'deployedCodeHash', netId)
  if (!shouldMigrateECTools && !ECToolsSavedDeployedCodeHash) {
    console.log(`Couldn't find hash of the code we expect to be deployed for ECTools.`)
    shouldMigrateECTools = true
  }

  if (!shouldMigrateECTools) {
    ECToolsDeployedCodeHash = hash(await wallet.provider.getCode(ECToolsSavedAddress))
    if (ECToolsDeployedCodeHash === hash("0x")) {
      console.log(`Saved ECTools address doesn't contain any bytecode.`)
      shouldMigrateECTools = true
    } else if (ECToolsDeployedCodeHash !== ECToolsSavedDeployedCodeHash) {
      console.log(`Deployed ECTools has different bytecode than what we expected.`)
      shouldMigrateECTools = true
    }
  }

  // Migate!
  if (shouldMigrateECTools) {
    console.log(`Deploying a new ECTools contract..`)
    const ecToolsFactory = eth.ContractFactory.fromSolidity(ECToolsArtifacts)
    const ecTools = await ecToolsFactory.connect(wallet).deploy()
    let txHash = ecTools.deployTransaction.hash
    console.log(`Sent transaction to deploy ECTools, txHash: ${txHash}`)
    await wallet.provider.waitForTransaction(txHash)
    ECToolsAddress = ecTools.address
    ECToolsDeployedCodeHash = hash(await wallet.provider.getCode(ECToolsAddress))
    console.log(`ECTools has beed deployed to address: ${ECToolsAddress}`)
    console.log(`ECTools deployed code hash: ${ECToolsDeployedCodeHash.substring(0,16)}...`)
    // Update address-book w new info
    addresses.ECTools.networks[netId] = {
      "address" : ECToolsAddress,
      "compiledCodeHash": ECToolsCompiledCodeHash,
      "deployedCodeHash": ECToolsDeployedCodeHash
    }
  } else {
    ECToolsAddress = ECToolsSavedAddress
    console.log(`ECTools is up to date, no action required. Address: ${ECToolsAddress}`)
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
