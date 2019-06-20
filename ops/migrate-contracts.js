const fs = require('fs')
const eth = require('ethers')
const linker = require('solc/linker')

const ChallengeRegistryArtifacts = require('@counterfactual/contracts/build/ChallengeRegistry.json')
const ContractRegistryArtifacts = require('@counterfactual/contracts/build/ContractRegistry.json')
const ETHBalanceRefundAppArtifacts = require('@counterfactual/contracts/build/ETHBalanceRefundApp.json')
const ETHBucketArtifacts = require('@counterfactual/contracts/build/ETHBucket.json')
const ETHInterpreterArtifacts = require('@counterfactual/contracts/build/ETHInterpreter.json')
const LibStaticCallArtifacts = require('@counterfactual/contracts/build/LibStaticCall.json')
const MinimumViableMultisigArtifacts = require('@counterfactual/contracts/build/MinimumViableMultisig.json')
const MultiSendArtifacts = require('@counterfactual/contracts/build/MultiSend.json')
const ProxyFactoryArtifacts = require('@counterfactual/contracts/build/ProxyFactory.json')
const RootNonceRegistryArtifacts = require('@counterfactual/contracts/build/RootNonceRegistry.json')
const StateChannelTransactionArtifacts = require('@counterfactual/contracts/build/StateChannelTransaction.json')
const TwoPartyEthAsLumpArtifacts = require('@counterfactual/contracts/build/TwoPartyEthAsLump.json')
const TwoPartyVirtualEthAsLumpArtifacts = require('@counterfactual/contracts/build/TwoPartyVirtualEthAsLump.json')
const UninstallKeyRegistryArtifacts = require('@counterfactual/contracts/build/UninstallKeyRegistry.json')

////////////////////////////////////////
// Environment Setup

const project = 'indra-v2'
const cwd = process.cwd()
let HOME = (cwd.indexOf(project) !== -1)  ?
  `${cwd.substring(0,cwd.indexOf(project)+project.length)}` :
  `/root`
const addressBookPath = `${HOME}/address-book.json`
const addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'))

// Global scope vars
var netId
var wallet

////////////////////////////////////////
// Helper Functions

const getSavedData = (contractName, property) => {
  try {
    return addressBook[contractName].networks[netId][property]
  } catch (e) {
    return undefined
  }
}

// Write addressBook to disk if anything has changed
const saveAddressBook = (addressBook) => {
  console.log(`Saving updated migration artifacts`)
  try {
    fs.unlinkSync(addressBookPath)
    fs.writeFileSync(addressBookPath, JSON.stringify(addressBook,null,2))
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
  const bytecode = await wallet.provider.getCode(address)
  if (bytecode === "0x00" || bytecode === "0x") {
    console.log(`No bytecode exists at the address in our address book`)
    return false
  }
  return true
}

// Deploy contract & write resulting addressBook to our address-book file
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
  if (!addressBook[name]) addressBook[name] = {}
  if (!addressBook[name].networks) addressBook[name].networks = {}
  addressBook[name].networks[netId] = { address, ...saveArgs }
  saveAddressBook(addressBook)
  return contract
}

////////////////////////////////////////
// Begin executing main migration script in async wrapper function
// First, setup signer & connect to eth provider

;(async function() {
  let provider, signer, balance, nonce, isDeployed
  let ecToolsAddress, token, tokenAddress, channelManager, channelManagerAddress

  if (process.env.ETH_PROVIDER) {
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    provider = new eth.providers.InfuraProvider(process.env.ETH_NETWORK, process.env.INFURA_KEY)
  } else {
    provider = eth.getDefaultProvider(process.env.ETH_NETWORK)
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
    console.log(`Deployer Wallet: address=${wallet.address} nonce=${nonce} balance=${balance}`)
  } else {
    console.error(`Given network (${net}) doesn't match the network ID from provider: ${netId}`)
    process.exit(1)
  }


  ////////////////////////////////////////
  // Deploy lib contracts if needed

  console.log(`\nChecking for valid LibStaticCall contract...`)

  const libStaticCallSavedAddress = getSavedData('LibStaticCall', 'address')

  if (await contractIsDeployed(libStaticCallSavedAddress)) {
    libStaticCallAddress = libStaticCallSavedAddress
    console.log(`LibStaticCall is up to date, no action required\nAddress: ${libStaticCallAddress}`)
  } else {
    libStaticCallAddress = (await deployContract('LibStaticCall', LibStaticCallArtifacts, [])).address
  }


  ////////////////////////////////////////
  // Print summary

  console.log(`\nAll done!`)
  const spent = balance - eth.utils.formatEther(await wallet.getBalance())
  const nTx = (await wallet.getTransactionCount()) - nonce
  console.log(`Sent ${nTx} transaction${nTx === 1 ? '' : 's'} & spent ${spent} ETH`)

})();
