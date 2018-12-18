const ethers = require('ethers');
const axios = require('axios');
const ChannelManager = require('../contracts/build/contracts/ChannelManager.json') 

const url = 'http://indra.bohendo.com:3000'
const eth_provider = ethers.getDefaultProvider('ropsten');
const HASH_PREAMBLE = 'SpankWallet authentication message:'
const ChannelManagerAddress = '0xD6EA218b3F5FEb69A2674EFee592B1c7A589E268'

const private_key = '0xd033a1beb5cc0afd26fb3545da646596424496f8b3b52f098cb6e955d7e69e51'
const wallet = new ethers.Wallet(private_key, eth_provider);

let CM = new ethers.Contract(ChannelManagerAddress, ChannelManager.abi, eth_provider)

let CMsigner = CM.connect(wallet);

let challengeData = {
  nonce: '',
  address: '0x8d16F60c344BE8Da33Cf6dF3eb756086f14981eb',
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
      depositWei: '200',
      depositToken: '0',
      lastChanTx: 1,
      lastThreadUpdateId: 0
    })

    let state = res.data[res.data.length - 1].state.state
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
      state.sigHub,
      {
        value: new ethers.utils.BigNumber(state.pendingDepositWeiUser).toHexString()
      }
    )

    console.log(`I estimate this tx will require ${gas} gas`)

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
      {
        value: new ethers.utils.BigNumber(state.pendingDepositWeiUser).toHexString(),
        gasLimit: new ethers.utils.BigNumber(gas).toHexString()
      }
    )

    console.log(JSON.stringify(tx, null, 2))

  } catch(e) {
    console.log(e)
  }
}

const run = async () => {
  await authApiServiceTest()
  await channelApiServiceDepositTest()
}

run()


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
