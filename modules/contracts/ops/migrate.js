const fs = require('fs')
const eth = require('ethers')
const linker = require('solc/linker')
const channelManagerArtifacts = require('../build/contracts/ChannelManager.json')
const humanStandardTokenArtifacts = require('../build/contracts/HumanStandardToken.json')
const ecToolsArtifacts = require('../build/contracts/ECTools.json')

////////////////////////////////////////
// Environment Setup

const cwd = process.cwd()
let HOME = (cwd.indexOf('indra') !== -1)  ?
  `${cwd.substring(0,cwd.indexOf('indra')+5)}/modules/contracts` :
  `/root`
const addressesPath = `${HOME}/ops/address-book.json`
const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))
// Global scope vars
var netId
var wallet

////////////////////////////////////////
// Helper Functions

const getSavedData = (contractName, property) => {
  try {
    return addresses[contractName].networks[netId][property]
  } catch (e) {
    return undefined
  }
}

// Write addresses to disk if anything has changed
const saveAddresses = (addresses) => {
  console.log(`Saving updated migration artifacts`)
  try {
    fs.unlinkSync(addressesPath)
    fs.writeFileSync(addressesPath, JSON.stringify(addresses,null,2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e}`)
  }
}

// Simple sanity checks to make sure contracts from our address book have been deployed
const contractIsDeployed = async (address) => {
  if (!address) {
    console.log(`This contract is not in our address book.`)
    return false
  }
  if ((await wallet.provider.getCode(address)) === "0x00") {
    console.log(`No bytecode exists at the address in our address book`)
    return false
  }
  return true
}

// Deploy contract & write resulting addresses to our address-book file
const deployContract = async (name, artifacts, args) => {
  const factory = eth.ContractFactory.fromSolidity(artifacts)
  console.log(`Deploying a new ${name} contract..`)
  const contract = await factory.connect(wallet).deploy(...args.map(a=>a.value))
  const txHash = contract.deployTransaction.hash
  console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`)
  await wallet.provider.waitForTransaction(txHash)
  const address = contract.address
  console.log(`${name} has been deployed to address: ${address}`)
  // Update address-book w new address + the args we deployed with
  const saveArgs = {}
  args.forEach(a=> saveArgs[a.name] = a.value)
  addresses[name].networks[netId] = { address, ...saveArgs }
  saveAddresses(addresses)
  return address
}

////////////////////////////////////////
// Begin executing main migration script in async wrapper function
// First, setup signer & connect to eth provider

;(async function() {
  let provider, signer, balance, nonce, isDeployed
  let ecToolsAddress, tokenAddress, channelManagerAddress

  if (process.env.ETH_PROVIDER) {
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    provider = new eth.providers.InfuraProvider(process.env.ETH_NETWORK, process.env.INFURA_KEY)
  } else {
    provider = eth.providers.getDefaultProvider(process.env.ETH_NETWORK)
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

  try {
    netId = (await wallet.provider.getNetwork()).chainId // saved to global scope
    balance = eth.utils.formatEther(await wallet.getBalance())
    nonce = await wallet.getTransactionCount()
  } catch (e) {
    console.error(`Couldn't connect to eth provider: ${JSON.stringify(provider,null,2)}`)
    process.exit(1)
  }

  // Sanity check: Is our eth provider serving us the correct network?
  const net = process.env.ETH_NETWORK
  if (((net === "mainnet" || net === "live") && netId == 1) ||
      (net === "ropsten" && netId == 3) ||
      ((net === "rinkeby" || net === "staging") && netId == 4) ||
      (net === "kovan" && netId == 42) ||
      (net === "ganache" && netId == 4447)) {
    console.log(`\nPreparing to migrate contracts to ${net} network (${netId})`)
    console.log(`Hub Wallet: address=${wallet.address} nonce=${nonce} balance=${balance}`)
  } else {
    console.error(`Given network (${net}) doesn't match the network ID from provider: ${netId}`)
    process.exit(1)
  }


  ////////////////////////////////////////
  // Deploy a new ECTools if needed

  console.log(`\nChecking for valid ECTools..`)
  const ecToolsSavedAddress = getSavedData('ECTools', 'address')

  if (await contractIsDeployed(ecToolsSavedAddress)) {
    ecToolsAddress = ecToolsSavedAddress
    console.log(`ECTools is up to date, no action required\nAddress: ${ecToolsAddress}`)
  } else {
    ecToolsAddress = await deployContract('ECTools', ecToolsArtifacts, [])
  }

  ////////////////////////////////////////
  // Deploy a new token if needed

  console.log(`\nChecking for a valid token..`)
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
  // Deploy a new ChannelManager if needed

  console.log(`\nChecking for a valid ChannelManager..`)
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

    // Additional check: do the given ChannelManager's hub & token addresses match
    let channelManagerHub, channelManagerToken
    try {
      channelManagerHub = await channelManager.hub()
      channelManagerToken = await channelManager.functions.approvedToken()
    } catch (e) {
      console.log(`Bytecode at given ChannelManager address doesn't match the expected ABI`)
      isDeployed = false
    }

    if (channelManagerHub.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log(`This ChannelManager's hub doesn't match the current wallet`)
      console.log(`${channelManagerHub} !== ${wallet.address}`)
      isDeployed = false
    }

    channelManagerToken = await channelManager.functions.approvedToken()
    if (channelManagerToken.toLowerCase() !== tokenAddress.toLowerCase()) {
      console.log(`This ChannelManager's approvedToken doesn't match the given token`)
      console.log(`${channelManagerToken} !== ${tokenAddress}`)
      isDeployed = false
    }
  }

  // Done with checks, time to deploy the ChannelManager if needed
  if (isDeployed) {
    channelManagerAddress = channelManagerSavedAddress
    console.log(`ChannelManager is up to date, no action required\nAddress: ${channelManagerAddress}`)
  } else {
    // Link the ECTools address into ChannelManager bytecode
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
  console.log(`Sent ${nTx} transaction${nTx === 1 ? '' : 's'} & spent ${spent} ETH`)

})();
