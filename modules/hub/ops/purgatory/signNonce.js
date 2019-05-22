#!/usr/bin/env node

const Web3 = require('web3')

const w3 = new Web3(
  new Web3.providers.HttpProvider('http://geth.spankchain.com:8545'),
)

let msg = `SpankWallet authentication message: ${w3.sha3(
  process.argv[2],
)} ${w3.sha3('google.com')}`

const hash = w3.sha3(msg)

w3.eth.sign('0xbb1699d16368ebc13bdc29e6a1aad50a21be45eb', hash, (err, res) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(
    JSON.stringify({
      signature: res,
      nonce: process.argv[2],
      origin: 'google.com',
      address: '0xbb1699d16368ebc13bdc29e6a1aad50a21be45eb',
    }),
  )
})
