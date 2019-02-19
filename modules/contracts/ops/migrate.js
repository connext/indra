const crypto = require('crypto')
const fs = require('fs')
const eth = require('ethers')
const solc = require('solc')
const linker = require('solc/linker')
const channelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const humanStandardTokenArtifacts = require('../build/contracts/HumanStandardToken.json')
const ecToolsArtifacts = require('../build/contracts/ECTools.json')

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

var netId

////////////////////////////////////////
// Helper Functions

const hash = (message) => {
  return crypto.createHash('sha256').update(message).digest('hex')
}

const getSavedData = (contractName, property) => {
  let savedData
  try {
    return addresses[contractName].networks[netId][property]
  } catch (e) {
    return undefined
  }
}

// Begin executing main migration script
;(async function() {

  ////////////////////////////////////////
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

  let balance, nonce
  try {
    netId = (await wallet.provider.getNetwork()).chainId // set to top-level scope
    balance = await wallet.getBalance()
    nonce = await wallet.getTransactionCount()
  } catch (e) {
    console.error(`Couldn't connect to eth provider: ${JSON.stringify(provider,null,2)}`)
    process.exit(1)
  }

  console.log(`Connected to provider for network ${netId}, Wallet status: nonce=${nonce} balance=${balance}`)

  ////////////////////////////////////////
  // Check to see if we need to deploy a new ECTools

  console.log(`\nChecking ECTools contract..`)

  let shouldMigrateECTools = false
  let ecToolsAddress
  let ecToolsCompiledCodeHash
  let ecToolsDeployedCodeHash
  const ecToolsSavedAddress = getSavedData('ECTools', 'address')
  const ecToolsSavedCompiledCodeHash = getSavedData('ECTools', 'compiledCodeHash')
  const ecToolsSavedDeployedCodeHash = getSavedData('ECTools', 'deployedCodeHash')

  // Flag for migration if we aren't given an address
  if (!ecToolsSavedAddress) {
    console.log(`Couldn't find a saved address for ECTools.`)
    shouldMigrateECTools = true
  }

  // Flag for migration if source code has been updated
  ecToolsCompiledCodeHash = hash(ecToolsArtifacts.bytecode)
  if (!shouldMigrateECTools && ecToolsCompiledCodeHash !== ecToolsSavedCompiledCodeHash) {
    console.log(`Source code of ECTools code has been updated.`)
    shouldMigrateECTools = true
  }

  // Flag for migration if we don't know what bytecode to expect at this address
  if (!shouldMigrateECTools && !ecToolsSavedDeployedCodeHash) {
    console.log(`Couldn't find hash of the code we expect to be deployed for ECTools.`)
    shouldMigrateECTools = true
  }

  // Flag for migration if given address isn't a contract or has unexpected bytecode
  if (!shouldMigrateECTools) {
    ecToolsDeployedCodeHash = hash(await wallet.provider.getCode(ecToolsSavedAddress))
    if (ecToolsDeployedCodeHash === hash("0x")) {
      console.log(`Saved ECTools address doesn't contain any bytecode.`)
      shouldMigrateECTools = true
    } else if (ecToolsDeployedCodeHash !== ecToolsSavedDeployedCodeHash) {
      console.log(`Deployed ECTools has different bytecode than what we expected.`)
      shouldMigrateECTools = true
    }
  }

  ////////////////////////////////////////
  // Deploy a new ECTools if needed

  // If no migration flag, then no action is required
  if (!shouldMigrateECTools) {
    ecToolsAddress = ecToolsSavedAddress
    console.log(`ECTools is up to date, no action required.`)
    console.log(`Address: ${ecToolsAddress}`)

  // If migration flag, then deploy a new ECTools
  } else {
    console.log(`Deploying a new ECTools contract..`)
    const ecToolsFactory = eth.ContractFactory.fromSolidity(ecToolsArtifacts)
    const ecTools = await ecToolsFactory.connect(wallet).deploy()
    let txHash = ecTools.deployTransaction.hash
    console.log(`Sent transaction to deploy ECTools, txHash: ${txHash}`)
    await wallet.provider.waitForTransaction(txHash)
    ecToolsAddress = ecTools.address
    ecToolsDeployedCodeHash = hash(await wallet.provider.getCode(ecToolsAddress))
    console.log(`ECTools has been deployed to address: ${ecToolsAddress}`)
    console.log(`ECTools deployed code hash: ${ecToolsDeployedCodeHash.substring(0,16)}...`)
    // Update address-book w new info
    addresses.ECTools.networks[netId] = {
      "address" : ecToolsAddress,
      "compiledCodeHash": ecToolsCompiledCodeHash,
      "deployedCodeHash": ecToolsDeployedCodeHash
    } // TODO: save old addresses if this one was clobbered
  }

  ////////////////////////////////////////
  // Check to see if we need to deploy a new token

  console.log(`\nChecking for a valid token`)

  let shouldMigrateToken = false
  let tokenAddress
  const tokenSavedAddress = getSavedData('tokens', 'address')
  const tokenName = getSavedData('tokens', 'name') || 'unknown'
  const tokenSupply = getSavedData('tokens', 'supply')
  const tokenDecimals = getSavedData('tokens', 'decimals')
  const tokenSymbol = getSavedData('tokens', 'symbol')

  // Flag for migration if we aren't given a token address
  if (!tokenSavedAddress) {
    console.log(`Couldn't find a saved address for token ${tokenName}.`)
    shouldMigrateToken = true
  }

  // Flag for migration if given address isn't a contract
  if (!shouldMigrateToken) {
    const tokenDeployedCode = await wallet.provider.getCode(tokenSavedAddress)
    if (tokenDeployedCode === "0x") {
      console.log(`A contract has not been deployed to the provided token address`)
      shouldMigrateToken = true
    }
  }

  ////////////////////////////////////////
  // Deploy a new token if needed

  // If no migration flag, no action required
  if (!shouldMigrateToken) {
    tokenAddress = tokenSavedAddress
    console.log(`${tokenName} token is up to date, no action required.`)
    console.log(`Address: ${tokenAddress}`)

  // If migration flag in dev mode, deploy new contract
  } else if (netId === 4447) {
    console.log(`Deploying a new HumanStandardToken contract..`)
    const tokenFactory = await eth.ContractFactory.fromSolidity(humanStandardTokenArtifacts)
    const token = await tokenFactory.connect(wallet).deploy(
      tokenSupply,
      tokenName,
      tokenDecimals,
      tokenSymbol
    )
    let txHash = token.deployTransaction.hash
    console.log(`Sent transaction to deploy token, txHash: ${txHash}`)
    await wallet.provider.waitForTransaction(txHash)
    tokenAddress = token.address
    console.log(`Token has been deployed to address: ${tokenAddress}`)
    // Update address-book w new info
    addresses.tokens.networks[netId] = {
      "address" : tokenAddress,
      "name": tokenName,
      "supply": tokenSupply,
      "decimals": tokenDecimals,
      "symbol": tokenSymbol
    } // TODO: save old addresses if this one was clobbered

  // If migration flag in prod mode, this is a problem. abort
  } else {
    console.error(`In production, a token (ie ${tokenName}) needs to already have been deployed & saved in our address book`)
    process.exit(1)
  }

  ////////////////////////////////////////
  // Check to see if we need to deploy a new ChannelManager

  console.log(`\nChecking for a valid ChannelManager`)

  let shouldMigrateChannelManager = false
  let channelManagerAddress

  const challengePeriod = getSavedData('ChannelManager', 'challengePeriod') || '600'
  const channelManagerSavedAddress = getSavedData('ChannelManager', 'address')
  const channelManagerSavedHub = getSavedData('ChannelManager', 'address')
  const channelManagerSavedToken = getSavedData('ChannelManager', 'address')

  // Flag for migration if we aren't given an address
  if (!channelManagerSavedAddress) {
    console.log(`Couldn't find a saved address for ChannelManager.`)
    shouldMigrateChannelManager = true
  }

  // Flag for migration if given address isn't a contract
  if (!shouldMigrateChannelManager) {
    const channelManagerDeployedCode = await wallet.provider.getCode(channelManagerSavedAddress)
    if (channelManagerDeployedCode === "0x") {
      console.log(`A contract has not been deployed to the provided ChannelManager address`)
      shouldMigrateChannelManager = true
    }
  }

  // Flag for migration if we aren't linked to the correct token/ECTools
  if (!shouldMigrateChannelManager) {
    const channelManager = new eth.Contract(
      channelManagerSavedAddress,
      channelManagerArtifacts.abi,
      provider
    )

    try {
      const channelManagerHub = await channelManager.hub()
      if (channelManagerHub !== wallet.address) {
        console.log(`This ChannelManager's hub doesn't match the current wallet`)
        console.log(`${channelManagerHub} !== ${wallet.address}`)
        shouldMigrateChannelManager = true
      }

      const channelManagerToken = await channelManager.functions.approvedToken()
      if (channelManagerToken !== tokenAddress) {
        console.log(`This ChannelManager's approvedToken doesn't match the given token`)
        console.log(`${channelManagerToken} !== ${tokenAddress}`)
        shouldMigrateChannelManager = true
      }

    } catch (e) {
      console.log(`ChannelManager bytecode deployed to ${channelManagerSavedAddress} is invalid`)
      shouldMigrateChannelManager = true
    }
  }

  // Flag for migration if the version has been incremented?


  ////////////////////////////////////////
  // Deploy a new ChannelManager if needed

  // If no migration flag, then no further action is required
  if (!shouldMigrateChannelManager) {
    channelManagerAddress = channelManagerSavedAddress
    console.log(`ChannelManager is up to date, no action required`)
    console.log(`Address: ${channelManagerAddress}`)

  // If migration flag, then deploy a new ChannelManager contract
  } else {
    console.log(`Deploying new ChannelManager with args:`)
    console.log(`hub=${wallet.address} challengePeriod=${challengePeriod} tokenAddress=${tokenAddress}`)
    const channelManagerBytecode = linker.linkBytecode(channelManagerArtifacts.bytecode, {
      'ECTools': ecToolsAddress
    })
    const channelManagerFactory = new eth.ContractFactory(
      channelManagerArtifacts.abi,
      channelManagerBytecode,
      wallet
    )
    const channelManager = await channelManagerFactory.deploy(wallet.address, challengePeriod, tokenAddress)
    let txHash = channelManager.deployTransaction.hash
    console.log(`Sent transaction to deploy ChannelManager, txHash: ${txHash}`)
    await wallet.provider.waitForTransaction(txHash)
    channelManagerAddress = channelManager.address
    console.log(`ChannelManager has been deployed to address: ${channelManagerAddress}`)

    // Update address-book w new info
    addresses.ChannelManager.networks[netId] = {
      "links": {
        "ECTools": ecToolsAddress
      },
      "address" : channelManagerAddress,
      "challengePeriod": challengePeriod,
      "hub": wallet.address,
      "approvedToken": tokenAddress
    } // TODO: save old addresses if this one was clobbered?
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
