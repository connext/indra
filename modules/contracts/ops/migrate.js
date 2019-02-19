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

// Global scope vars
var netId
var wallet

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

// Write addresses to disk if anything has changed
const saveAddresses = (addresses) => {
  const oldAddresses = JSON.stringify(JSON.parse(fs.readFileSync(addressesPath, 'utf8')))
  const newAddresses = JSON.stringify(addresses)
  if (oldAddresses !== newAddresses) {
    console.log(`Saving updated migration artifacts..`)
    try {
      fs.unlinkSync(addressesPath)
      fs.writeFileSync(addressesPath, JSON.stringify(addresses,null,2))
      console.log(`Success!`)
    } catch (e) {
      console.log(`Error saving artifacts: ${e}`)
    }
  } else {
    console.log(`No artifact changes to save`)
  }
}

// Simple sanity checks to make sure contracts from our address book have been deployed
const contractIsDeployed = async (address) => {
  if (!address) {
    console.log(`This contract is not in our address book.`)
    return false
  }
  const deployedCode = await wallet.provider.getCode(address)
  if (deployedCode === "0x00") {
    console.log(`No bytecode exists at the address in our address book`)
    return false
  }
  return true
}

const deployContract = async (name, artifacts, args) => {
  console.log(`Deploying a new ${name} contract..`)
  const factory = eth.ContractFactory.fromSolidity(artifacts)
  const contract = await factory.connect(wallet).deploy(...args.map(a=>a.value))
  const txHash = contract.deployTransaction.hash
  console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`)
  await wallet.provider.waitForTransaction(txHash)
  const address = contract.address
  console.log(`${name} has been deployed to address: ${address}`)
  // Update address-book w new info
  const saveArgs = {}
  args.forEach(a=> saveArgs[a.name] = a.value)
  addresses[name].networks[netId] = {
    "address" : address,
    ...saveArgs
  }
  saveAddresses(addresses)
  return address
}

// Begin executing main migration script
;(async function() {

  ////////////////////////////////////////
  // Setup signer & connect to eth provider

  let provider, signer, balance, nonce, isDeployed
  let ecToolsAddress, tokenAddress, channelManagerAddress

  if (process.env.ETH_PROVIDER) {
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    provider = new eth.providers.InfuraProvider(network, process.env.INFURA_KEY)
  } else {
    provider = eth.providers.getDefaultProvider(network)
  }

  if (process.env.PRIVATE_KEY_FILE) {
    signer = new eth.Wallet(fs.readFileSync(process.env.PRIVATE_KEY_FILE, 'utf8'))
  } else if (process.env.ETH_MNEMONIC) {
    signer = eth.Wallet.fromMnemonic(process.env.ETH_MNEMONIC)
  } else {
    console.error(`Couldn't setup signer: no private key or mnemonic found`)
    process.exit(1)
  }

  wallet = signer.connect(provider) // saved to global scope

  console.log(`\nPreparing to migrate contracts using hub account ${wallet.address} `)

  try {
    netId = (await wallet.provider.getNetwork()).chainId // saved to global scope
    balance = eth.utils.formatEther(await wallet.getBalance())
    nonce = await wallet.getTransactionCount()
  } catch (e) {
    console.error(`Couldn't connect to eth provider: ${JSON.stringify(provider,null,2)}`)
    process.exit(1)
  }

  console.log(`Connected to provider for network ${netId}, Wallet status: nonce=${nonce} balance=${balance}`)

  ////////////////////////////////////////
  // Deploy a new ECTools if needed

  console.log(`\nChecking ECTools contract..`)
  const ecToolsSavedAddress = getSavedData('ECTools', 'address')

  if (await contractIsDeployed(ecToolsSavedAddress)) {
    ecToolsAddress = ecToolsSavedAddress
    console.log(`ECTools is up to date, no action required\nAddress: ${ecToolsAddress}`)
  } else {
    ecToolsAddress = await deployContract('ECTools', ecToolsArtifacts, [])
  }

  ////////////////////////////////////////
  // Deploy a new token if needed

  console.log(`\nChecking for a valid token`)
  const tokenSavedAddress = getSavedData('tokens', 'address')
  const tokenSupply = getSavedData('tokens', 'supply') || '1000000000000000000000000000' 
  const tokenName = getSavedData('tokens', 'name') || 'Test' 
  const tokenDecimals = getSavedData('tokens', 'decimals') || '18' 
  const tokenSymbol = getSavedData('tokens', 'symbol') || 'TST' 

  if (await contractIsDeployed(tokenSavedAddress)) {
    tokenAddress = tokenSavedAddress
    console.log(`${tokenName} token is up to date, no action required\nAddress: ${tokenAddress}`)
  } else if (netId === 4447) { // We should only deploy new token contracts in dev-mode
    tokenAddress = await deployContract('tokens', humanStandardTokenArtifacts, [
      { name: 'supply', value: tokenSupply },
      { name: 'name', value: tokenName },
      { name: 'decimals', value: tokenDecimals },
      { name: 'symbol', value: tokenSymbol }
    ])
  } else {
    console.error(`A properly deployed token must be included in our address book`)
    process.exit(1)
  }

  ////////////////////////////////////////
  // Check to see if we need to deploy a new ChannelManager

  console.log(`\nChecking for a valid ChannelManager`)

  const channelManagerSavedAddress = getSavedData('ChannelManager', 'address')
  const channelManagerSavedHub = getSavedData('ChannelManager', 'address')
  const channelManagerSavedToken = getSavedData('ChannelManager', 'address')
  const challengePeriod = getSavedData('ChannelManager', 'challengePeriod') || '600'

  isDeployed = await contractIsDeployed(channelManagerSavedAddress)

  // Flag for migration if we aren't linked to the correct token/hub
  if (isDeployed) {
    const channelManager = new eth.Contract(
      channelManagerSavedAddress,
      channelManagerArtifacts.abi,
      provider
    )

    let channelManagerHub
    let channelManagerToken
    try {
      channelManagerHub = await channelManager.hub()
      channelManagerToken = await channelManager.functions.approvedToken()
    } catch (e) {
      console.log(`Bytecode at given ChannelManager address doesn't match the expected ABI`)
      isDeployed = false
    }

    if (channelManagerHub !== wallet.address) {
      console.log(`This ChannelManager's hub doesn't match the current wallet`)
      console.log(`${channelManagerHub} !== ${wallet.address}`)
      isDeployed = false
    }

    channelManagerToken = await channelManager.functions.approvedToken()
    if (channelManagerToken !== tokenAddress) {
      console.log(`This ChannelManager's approvedToken doesn't match the given token`)
      console.log(`${channelManagerToken} !== ${tokenAddress}`)
      isDeployed = false
    }
  }

  if (isDeployed) {
    channelManagerAddress = channelManagerSavedAddress
    console.log(`ChannelManager is up to date, no action required\nAddress: ${channelManagerAddress}`)

  // If migration flag, then deploy a new ChannelManager contract
  } else {

    channelManagerArtifacts.bytecode = linker.linkBytecode(channelManagerArtifacts.bytecode, {
      'ECTools': ecToolsAddress
    })

    channelManagerAddress = await deployContract('ChannelManager', channelManagerArtifacts, [
      { name: 'hub', value: wallet.address },
      { name: 'challengePeriod', value: challengePeriod },
      { name: 'approvedToken', value: tokenAddress }
    ])
  }

  ////////////////////////////////////////
  // Print summary

  console.log(`\nAll done!`)
  const spent = balance - eth.utils.formatEther(await wallet.getBalance())
  const nTx = (await wallet.getTransactionCount()) - nonce
  console.log(`Sent ${nTx} transaction${nTx === 1 ? '' : 's'} & paid ${spent} ETH in gas`)

})();
