const fs = require('fs')
const eth = require('ethers')
const linker = require('solc/linker')

const ChallengeRegistryArtifacts = require('@counterfactual/contracts/build/ChallengeRegistry.json')
const ConditionalTransactionDelegateTargetArtifacts = require('@counterfactual/contracts/build/ConditionalTransactionDelegateTarget.json')
const ETHBalanceRefundAppArtifacts = require('@counterfactual/contracts/build/ETHBalanceRefundApp.json')
const ETHBucketArtifacts = require('@counterfactual/contracts/build/ETHBucket.json')
const ETHInterpreterArtifacts = require('@counterfactual/contracts/build/ETHInterpreter.json')
const LibStaticCallArtifacts = require('@counterfactual/contracts/build/LibStaticCall.json')
const MinimumViableMultisigArtifacts = require('@counterfactual/contracts/build/MinimumViableMultisig.json')
const MultiSendArtifacts = require('@counterfactual/contracts/build/MultiSend.json')
const ProxyFactoryArtifacts = require('@counterfactual/contracts/build/ProxyFactory.json')
const RootNonceRegistryArtifacts = require('@counterfactual/contracts/build/RootNonceRegistry.json')
const TwoPartyEthAsLumpArtifacts = require('@counterfactual/contracts/build/TwoPartyEthAsLump.json')
const TwoPartyVirtualEthAsLumpArtifacts = require('@counterfactual/contracts/build/TwoPartyVirtualEthAsLump.json')
const UninstallKeyRegistryArtifacts = require('@counterfactual/contracts/build/UninstallKeyRegistry.json')

////////////////////////////////////////
// Environment Setup

const botMnemonics = [
  'humble sense shrug young vehicle assault destroy cook property average silent travel',
  'roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult',
]
const cfPath = "m/44'/60'/0'/25446"
const ethGift = '3' // Starting balance for node & payment bots on test nets

const project = 'indra-v2'
const cwd = process.cwd()
const HOME = (cwd.indexOf(project) !== -1)  ?
  `${cwd.substring(0,cwd.indexOf(project)+project.length)}` :
  `/root`
const addressBookPath = `${HOME}/address-book.json`
const addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'))

// Global scope vars
var netId
var wallet
var mnemonic

////////////////////////////////////////
// Helper Functions

const getSavedData = (contractName, property) => {
  try {
    return addressBook[netId][contractName][property]
  } catch (e) {
    return undefined
  }
}

// Write addressBook to disk if anything has changed
const saveAddressBook = (addressBook) => {
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
  const contract = await factory.connect(wallet).deploy(...args.map(a=>a.value))
  const txHash = contract.deployTransaction.hash
  console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`)
  await wallet.provider.waitForTransaction(txHash)
  const address = contract.address
  console.log(`${name} has been deployed to address: ${address}`)
  // Update address-book w new address + the args we deployed with
  const saveArgs = {}
  args.forEach(a=> saveArgs[a.name] = a.value)
  if (!addressBook[netId]) addressBook[netId] = {}
  if (!addressBook[netId][name]) addressBook[netId][name] = {}
  addressBook[netId][name] = { address, ...saveArgs }
  saveAddressBook(addressBook)
  return contract
}


const maybeDeployContract = async (name, artifacts, args) => {
  console.log(`\nChecking for valid ${name} contract...`)
  const savedAddress = getSavedData(name, 'address')
  if (await contractIsDeployed(savedAddress)) {
    console.log(`${name} is up to date, no action required\nAddress: ${savedAddress}`)
    return savedAddress
  }
  return (await deployContract(name, artifacts, args)).address
}

////////////////////////////////////////
// Begin executing main migration script in async wrapper function
// First, setup signer & connect to eth provider

;(async function() {
  let provider, balance, nonce, isDeployed
  let ecToolsAddress, token, tokenAddress, channelManager, channelManagerAddress

  if (process.env.ETH_PROVIDER) {
    provider = new eth.providers.JsonRpcProvider(process.env.ETH_PROVIDER)
  } else if (process.env.INFURA_KEY) {
    provider = new eth.providers.InfuraProvider(process.env.ETH_NETWORK, process.env.INFURA_KEY)
  } else {
    provider = eth.getDefaultProvider(process.env.ETH_NETWORK)
  }

  if (process.env.ETH_MNEMONIC_FILE) {
    mnemonic = fs.readFileSync(process.env.ETH_MNEMONIC_FILE, 'utf8')
  } else if (process.env.ETH_MNEMONIC) {
    mnemonic = process.env.ETH_MNEMONIC
  } else {
    console.error(`Couldn't setup signer: no mnemonic found`)
    process.exit(1)
  }
  wallet = eth.Wallet.fromMnemonic(mnemonic).connect(provider) // saved to global scope

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
  // Deploy lib contracts

  const libStaticCallAddress = await maybeDeployContract(
    'LibStaticCall', LibStaticCallArtifacts, [],
  )

  // Link LibStaticCall address into bytecode of other libs
  ChallengeRegistryArtifacts.bytecode = linker.linkBytecode(
    ChallengeRegistryArtifacts.bytecode,
    { 'LibStaticCall': libStaticCallAddress },
  )
  TwoPartyVirtualEthAsLumpArtifacts.bytecode = linker.linkBytecode(
    TwoPartyVirtualEthAsLumpArtifacts.bytecode,
    { 'LibStaticCall': libStaticCallAddress },
  )
  ConditionalTransactionDelegateTargetArtifacts.bytecode = linker.linkBytecode(
    ConditionalTransactionDelegateTargetArtifacts.bytecode,
    { 'LibStaticCall': libStaticCallAddress },
  )

  // Deploy rest of the lib contracts
  const challengeRegistryAddress = await maybeDeployContract(
    'ChallengeRegistry', ChallengeRegistryArtifacts, [],
  )
  const twoPartyVirtualEthAsLumpAddress = await maybeDeployContract(
    'TwoPartyVirtualEthAsLump', TwoPartyVirtualEthAsLumpArtifacts, [],
  )
  const conditionalTransactionDelegateTargetAddress = await maybeDeployContract(
    'ConditionalTransactionDelegateTarget', ConditionalTransactionDelegateTargetArtifacts, [],
  )

  ////////////////////////////////////////
  // Deploy the rest of the core counterfactual contracts

  const ethBalanceRefundAppAddress = await maybeDeployContract(
    'ETHBalanceRefundApp', ETHBalanceRefundAppArtifacts, [],
  )
  const ethBucketAddress = await maybeDeployContract(
    'ETHBucket', ETHBucketArtifacts, [],
  )
  const ethInterpreterAddress = await maybeDeployContract(
    'ETHInterpreter', ETHInterpreterArtifacts, [],
  )
  const minimumViableMultisigAddress = await maybeDeployContract(
    'MinimumViableMultisig', MinimumViableMultisigArtifacts, [],
  )
  const multiSendAddress = await maybeDeployContract(
    'MultiSend', MultiSendArtifacts, [],
  )
  const proxyFactoryAddress = await maybeDeployContract(
    'ProxyFactory', ProxyFactoryArtifacts, [],
  )
  const rootNonceRegistryAddress = await maybeDeployContract(
    'RootNonceRegistry', RootNonceRegistryArtifacts, [],
  )
  const twoPartyEthAsLumpAddress = await maybeDeployContract(
    'TwoPartyEthAsLump', TwoPartyEthAsLumpArtifacts, [],
  )
  const uninstallKeyRegistryAddress = await maybeDeployContract(
    'UninstallKeyRegistry', UninstallKeyRegistryArtifacts, [],
  )

  ////////////////////////////////////////
  // Setup relevant accounts

  if (netId !== 1) { 

    const maybeSendGift = async (address) => {
      const balance = await wallet.provider.getBalance(address)
      if (balance.eq(eth.constants.Zero)) {
        const tx = await wallet.sendTransaction({ to: address, value: eth.utils.parseEther(ethGift) })
        await wallet.provider.waitForTransaction(tx.hash)
        console.log(`\nSent ${eth.constants.EtherSymbol} ${ethGift} to ${address}`)
        console.log(`Transaction hash: ${tx.hash}`)
      } else {
        console.log(`\nAccount ${address} already has ${eth.constants.EtherSymbol} ${eth.utils.formatEther(balance)}`)
      }
    }

    await maybeSendGift(eth.Wallet.fromMnemonic(mnemonic, cfPath).address)
    for (const botMnemonic of botMnemonics) {
      await maybeSendGift(eth.Wallet.fromMnemonic(botMnemonic).address)
      await maybeSendGift(eth.Wallet.fromMnemonic(botMnemonic, cfPath).address)
    }
  }


  ////////////////////////////////////////
  // Print summary

  console.log(`\nAll done!`)
  const spent = balance - eth.utils.formatEther(await wallet.getBalance())
  const nTx = (await wallet.getTransactionCount()) - nonce
  console.log(`Sent ${nTx} transaction${nTx === 1 ? '' : 's'} & spent ${eth.constants.EtherSymbol} ${spent}`)

})();
