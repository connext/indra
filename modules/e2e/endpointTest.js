const ethers = require('ethers');
const axios = require('axios');

const url = 'http://indra.bohendo.com:3000'
const HASH_PREAMBLE = 'SpankWallet authentication message:'

let challengeData = {
  nonce: '',
  address: '0x64d3c7c65ff1182ea882292a0012ed0ef74fcaaf',
  origin: 'localhost',
  signature: ''
}

const private_key = '0xa76d14d7fbbf2868ebd9580305aec6461319b2f261c7a75b0763c79165b41ec2'
const wallet = new ethers.Wallet(private_key);

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
}

authApiServiceTest()

axios.post(url + `/channel/${challengeData.address}/request-deposit`, {
  depositWei: '500000',
	depositToken: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
	lastChanTx: 0,
	lastThreadUpdateId: 0
})
  .then(function (res) {
    console.log(JSON.stringify(res.data[0].state, null, 2))
    console.log(JSON.stringify(res.data[1].state, null, 2))
  })
  .catch(function (error) {
    console.log(error)
  })

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
