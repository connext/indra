const ethers = require('ethers');
const axios = require('axios');
const ChannelManager = require('../contracts/build/contracts/ChannelManager.json') 

const url = 'http://indra.bohendo.com:3000'
const eth_provider = ethers.getDefaultProvider('ropsten');
const HASH_PREAMBLE = 'SpankWallet authentication message:'
const ChannelManagerAddress = '0xD6EA218b3F5FEb69A2674EFee592B1c7A589E268'
const private_key = '0xa76d14d7fbbf2868ebd9580305aec6461319b2f261c7a75b0763c79165b41ec2'
const wallet = new ethers.Wallet(private_key, eth_provider);

let CM = new ethers.Contract(ChannelManagerAddress, ChannelManager.abi, eth_provider)

let CMsigner = CM.connect(wallet);

let challengeData = {
  nonce: '',
  address: '0x64d3c7c65ff1182ea882292a0012ed0ef74fcaaf',
  origin: 'localhost',
  signature: ''
}

async function authApiServiceTest() {
  try {
    // Get Challenge Nonce
    let res = await axios.post(url + '/auth/challenge')
    challengeData.nonce = res.data.nonce

    let hash = ethers.utils.id(`${HASH_PREAMBLE} ${ethers.utils.id(challengeData.nonce)} ${ethers.utils.id(challengeData.origin)}`)
    challengeData.signature = await wallet.signMessage(ethers.utils.arrayify(hash));

    try {
      // Send signed challenge response
      res = await axios.post(url + '/auth/response', challengeData)
      console.log(res.data.token)
    } catch(e) {
      console.log(e)
    }

  } catch(e) {
    console.log(e)
  }
}

async function channelApiServiceDepositTest() {
  try {
    let res = await axios.post(url + `/channel/${challengeData.address}/request-deposit`, {
      depositWei: '100',
      depositToken: '0',
      lastChanTx: 0,
      lastThreadUpdateId: 0
    })

    let state = res.data[9].state.state
    console.log(state, res.data.length)

    let gas = await CMsigner.estimate.userAuthorizedUpdate(
      state.recipient, // recipient
      [
        state.balanceWeiHub,
        state.balanceWeiUser,
      ],
      [
        state.balanceTokenHub,
        state.balanceTokenUser,
      ],
      [
        state.pendingDepositWeiHub,
        state.pendingWithdrawalWeiHub,
        state.pendingDepositWeiUser,
        state.pendingWithdrawalWeiUser,
      ],
      [
        state.pendingDepositTokenHub,
        state.pendingWithdrawalTokenHub,
        state.pendingDepositTokenUser,
        state.pendingWithdrawalTokenUser,
      ],
      [state.txCountGlobal, state.txCountChain],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub
    )

    console.log(`I estimate this tx will take ${gas} gas`)
    return;

    let tx = await CMsigner.userAuthorizedUpdate(
      state.recipient, // recipient
      [
        state.balanceWeiHub,
        state.balanceWeiUser,
      ],
      [
        state.balanceTokenHub,
        state.balanceTokenUser,
      ],
      [
        state.pendingDepositWeiHub,
        state.pendingWithdrawalWeiHub,
        state.pendingDepositWeiUser,
        state.pendingWithdrawalWeiUser,
      ],
      [
        state.pendingDepositTokenHub,
        state.pendingWithdrawalTokenHub,
        state.pendingDepositTokenUser,
        state.pendingWithdrawalTokenUser,
      ],
      [state.txCountGlobal, state.txCountChain],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub,
      {gasLimit: gas}
    )

    //console,log(JSON.stringify(tx, null, 2))

  } catch(e) {
    console.log(e)
  }
}

channelApiServiceDepositTest()

/*
authApiServiceTest()

axios.get(url + `/channel/${challengeData.address}/sync`, {
  params: {
    lastChanTx: 1,
    lastThreadUpdateId: 0
  }
})
  .then( res => {
    console.log(JSON.stringify(res.data[0].state, null, 2))
  })
  .catch( e => {
    console.log(e)
  })
*/
