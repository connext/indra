require('dotenv').config()
const Web3 = require('web3')
const ledgerChannelArtifacts = require('../artifacts/LedgerChannel.json')

let web3, channelManager, ledgerChannel

module.exports.initWeb3 = async () => {
  let accountAddress
  if (process.env.ETH_LOCAL) {
    console.log('Connecting to local ETH node')

    const port = process.env.ETH_PORT ? process.env.ETH_PORT : '9545'
    web3 = new Web3(`ws://localhost:${port}`)
    const accounts = await web3.eth.getAccounts()
    accountAddress = accounts[0]
    console.log('accountAddress: ', accountAddress)
  } else {
    if (!process.env.ETH_KEY) {
      throw new Error(
        'No ETH private key detected, please configure one in the environment settings.'
      )
    }
    console.log(`Connecting to ETH node at ${process.env.ETH_NODE_URL}`)
    web3 = new Web3(process.env.ETH_NODE_URL)
    const account = web3.eth.accounts.privateKeyToAccount(process.env.ETH_KEY)
    web3.eth.accounts.wallet.add(account)
    accountAddress = web3.eth.accounts.wallet[0].address
    console.log('accountAddress: ', accountAddress)
  }
  const balance = await web3.eth.getBalance(accountAddress)
  console.log('balance: ', balance)
}

module.exports.getWeb3 = () => {
  if (!web3) {
    throw new Error('Problem connecting to web3')
  } else {
    return web3
  }
}

module.exports.initLedgerChannel = async ledgerChannelAddress => {
  if (!web3) {
    throw new Error('Web3 not found')
  } else {
    if (ledgerChannelAddress) {
      ledgerChannel = new web3.eth.Contract(
        ledgerChannelArtifacts.abi,
        ledgerChannelAddress
      )
    } else {
      if (process.env.ETH_LOCAL) {
        // use truffle development address
        if (ledgerChannelArtifacts.networks['4447'].address) {
          console.log(
            `Found deployed contract at ${ledgerChannelArtifacts.networks['4447'].address}`
          )
          ledgerChannel = new web3.eth.Contract(
            ledgerChannelArtifacts.abi,
            ledgerChannelArtifacts.networks['4447'].address
          )
        } else {
          throw new Error('No local deployment found')
        }
      } else {
        throw new Error('No contract address specified')
      }
    }
  }
}

module.exports.getLedgerChannel = () => {
  if (!ledgerChannel) {
    throw new Error('Problem initializing contract')
  } else {
    return ledgerChannel
  }
}

module.exports.initChannelManager = async channelManagerAddress => {
  if (!web3) {
    throw new Error('Web3 not found')
  } else {
    if (channelManagerAddress) {
      channelManager = new web3.eth.Contract(
        channelManagerArtifacts.abi,
        channelManagerAddress
      )
    } else {
      if (process.env.ETH_LOCAL) {
        // use truffle development address
        if (channelManagerArtifacts.networks['4447'].address) {
          console.log(
            `Found deployed contract at ${channelManagerArtifacts.networks['4447'].address}`
          )
          channelManager = new web3.eth.Contract(
            channelManagerArtifacts.abi,
            channelManagerArtifacts.networks['4447'].address
          )
        } else {
          throw new Error('No local deployment found')
        }
      } else {
        throw new Error('No contract address specified')
      }
    }
  }
}

module.exports.getChannelManager = () => {
  if (!channelManager) {
    throw new Error('Problem initializing contract')
  } else {
    return channelManager
  }
}
