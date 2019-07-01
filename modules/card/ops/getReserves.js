const ChannelManagerAbi = require('./abi/ChannelManager.json');
const Web3 = require('web3')

// This function returns the hubs token and wei balance
// reserves from the contract

// to call this function, run the following:
// RPC_URL="https://eth-rinkeby.alchemyapi.io/jsonrpc/RvyVeludt7uwmt2JEF2a1PvHhJd5c07b" CM_ADDRESS="0x083c8bc6bc6f873091b43ae66cd50abef5c35f99" node getReserves.js

// the RPC_URL and the CM_ADDRESS should correspond to the network you are looking to find reserves in
// the 

async function getReserves() {
  // TODO: hit hub endpoint to get addresses
  // once config endpoint is in place
  const web3 = new Web3(process.env.RPC_URL)

  console.log('Investigating contract at:', process.env.CM_ADDRESS)
  
  const cm = new web3.eth.Contract(ChannelManagerAbi.abi, process.env.CM_ADDRESS)

  const wei = await cm.methods.getHubReserveWei().call()
  const token = await cm.methods.getHubReserveTokens().call()

  console.log('hub wei reserves: ', wei);
  console.log('hub token reserves: ', token);
  return
}

getReserves().then(() => {})