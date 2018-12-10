const ethers = require('ethers');
const axios = require('axios');

const url = 'http://indra.bohendo.com:3000'

var challengeData = {
  HASH_PREAMBLE: 'SpankWallet authentication message:',
  nonce: '',
  address: '0x64d3c7c65ff1182ea882292a0012ed0ef74fcaaf',
  origin: 'localhost'
}
const private_key = '0xa76d14d7fbbf2868ebd9580305aec6461319b2f261c7a75b0763c79165b41ec2'

function sendChallengeResponse() {
  // sha3 (hash_preamble nonce origin)
  let wallet = new ethers.Wallet(private_key);

  let hash = ethers.utils.id(`${challengeData.HASH_PREAMBLE} ${ethers.utils.id(challengeData.nonce)} ${ethers.utils.id(challengeData.origin)}`)
  
  let binaryData = ethers.utils.arrayify(hash);

  wallet.signMessage(binaryData).then((signature) => {
    axios.post(url + '/auth/response', {
      address: challengeData.address,
      nonce: challengeData.nonce,
      origin: challengeData.origin,
      signature: signature
    })
      .then(function (res) {
        console.log(res)
      })
      .catch(function (error) {
        console.log(error)
      })
  })
}

function startChallenge() {
  axios.post(url + '/auth/challenge')
    .then(function (res) {
      challengeData.nonce = res.data.nonce
      sendChallengeResponse()
    })
    .catch(function (error) {
      console.log(error)
    });
}

//getChallengeNonce()

axios.post(url + `/channel/${challengeData.address}/request-deposit`, {
  depositWei: '500000',
	depositToken: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
	lastChanTx: 0,
	lastThreadUpdateId: 0
})
  .then(function (res) {
    console.log(res)
  })
  .catch(function (error) {
    console.log(error)
  })
