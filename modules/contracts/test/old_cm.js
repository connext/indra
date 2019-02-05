"use strict";
const should = require("chai")
// const Connext = require("../client/dist/Utils.js");
const HttpProvider = require("ethjs-provider-http")
const ethjsUtil = require('ethereumjs-util')
const EthRPC = require("ethjs-rpc")
const config = require("./config.json")
const Utils = require("./helpers/utils");
const privKeys = require("./privKeys.json")
const EC = artifacts.require("./ECTools.sol")
const Ledger = artifacts.require("./ChannelManager.sol")
const Token = artifacts.require("./lib/HumanStandardToken.sol")

should
  .use(require("chai-as-promised"))
  .should()

const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const SolRevert = "VM Exception while processing transaction: revert"
const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

async function snapshot() {
    return new Promise((accept, reject) => {
        ethRPC.sendAsync({method: `evm_snapshot`}, (err, result)=> {
        if (err) {
            reject(err)
        } else {
            accept(result)
        }
        })
    })
  }

async function restore(snapshotId) {
    return new Promise((accept, reject) => {
      ethRPC.sendAsync({method: `evm_revert`, params: [snapshotId]}, (err, result) => {
        if (err) {
          reject(err)
        } else {
          accept(result)
        }
      })
    })
  }

async function moveForwardSecs(secs) {
  await ethRPC.sendAsync({
    jsonrpc:'2.0', method: `evm_increaseTime`,
    params: [secs],
    id: 0
  }, (err)=> {`error increasing time`});
  const start = Date.now();
  // TODO why do we do these empty loops?
  while (Date.now() < start + 300) {}
  await ethRPC.sendAsync({method: `evm_mine`}, (err)=> {});
  while (Date.now() < start + 300) {}
  return true
}



function getEventParams(tx, event) {
  if (tx.logs.length > 0) {
    for (let idx = 0; idx < tx.logs.length; idx++) {
      if (tx.logs[idx].event == event) {
        return tx.logs[idx].args
      }
    }
  }
  return false
}

async function signChannelState(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    channelManager.address,
    {type: 'address[2]', value: [data.user, data.recipient]},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256[4]', value: data.pendingWeiUpdates},
    {type: 'uint256[4]', value: data.pendingTokenUpdates},
    {type: 'uint256[2]', value: data.txCount},
    {type: 'bytes32', value: data.threadRoot},
    data.threadCount,
    data.timeout
  )
  const sig = await web3.eth.accounts.sign(hash, privateKey)
  return sig.signature
}

async function signThreadState(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    {type: "address", value: channelManager.address},
    {type: 'address', value: data.sender},
    {type: 'address', value: data.receiver},
    {type: 'uint256', value: data.threadId},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256', value: data.txCount}
  )
  const sig = await web3.eth.accounts.sign(hash, privateKey)
  return sig.signature
}

async function signThreadUpdate(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    {type: "address", value: channelManager.address},
    {type: 'address', value: data.sender},
    {type: 'address', value: data.receiver},
    {type: 'uint256', value: data.threadId},
    {type: 'uint256[2]', value: data.updatedWeiBalances},
    {type: 'uint256[2]', value: data.updatedTokenBalances},
    {type: 'uint256', value: data.updatedTxCount}
  )
  const sig = await web3.eth.accounts.sign(hash, privateKey)
  return sig.signature
}

async function hubAuthorizedUpdate(data) {
  await channelManager.hubAuthorizedUpdate(
    data.user,
    data.recipient,
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigUser,
    {from: hub.address}
  )
}

async function userAuthorizedUpdate(data, user, wei=0) {
    await channelManager.userAuthorizedUpdate(
      data.recipient,
      data.weiBalances,
      data.tokenBalances,
      data.pendingWeiUpdates,
      data.pendingTokenUpdates,
      data.txCount,
      data.threadRoot,
      data.threadCount,
      data.timeout,
      data.sigHub,
      {from: user.address, value:wei}
    )
  }

async function emptyChannelWithChallenge(data, user) {
  await channelManager.emptyChannelWithChallenge(
    [data.user, data.recipient],
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigHub,
    data.sigUser,
    {from: user}
  )
}

async function startExitWithUpdate(data, user) {
  await channelManager.startExitWithUpdate(
    [data.user, data.recipient],
    data.weiBalances,
    data.tokenBalances,
    data.pendingWeiUpdates,
    data.pendingTokenUpdates,
    data.txCount,
    data.threadRoot,
    data.threadCount,
    data.timeout,
    data.sigHub,
    data.sigUser,
    {from:user}
  )
}

async function startExitThread(data, user) {
  await channelManager.startExitThread(
    data.user,
    data.sender,
    data.receiver,
    data.threadId,
    data.weiBalances,
    data.tokenBalances,
    data.proof,
    data.sig,
    {from: user}
  )
}

async function startExitThreadWithUpdate(data, user) {
    await channelManager.startExitThreadWithUpdate(
        data.user,
        [data.sender, data.receiver],
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.proof,
        data.sig,
        data.updatedWeiBalances,
        data.updatedTokenBalances,
        data.updatedTxCount,
        data.updateSig,
        {from: user}
    )
}

async function challengeThread(data, user) {
    await channelManager.challengeThread(
        data.sender,
        data.receiver,
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.txCount,
        data.sig,
        {from: user}
    )
}

async function emptyThread(data, user) {
    await channelManager.emptyThread(
        data.user,
        data.sender,
        data.receiver,
        data.threadId,
        data.weiBalances,
        data.tokenBalances,
        data.proof,
        data.sig,
        {from: user}
    )
}

async function nukeThreads(data, user) {
    await channelManager.nukeThreads(
        data.user,
        {from: user}
    )
}

// Funds contract with eth and tokens
async function fundContract(eth, tokens) {
  await web3.eth.sendTransaction({
    to: channelManager.address,
    value: web3.utils.toWei(eth),
    from: hub.address
  })
  // let balance = await web3.eth.getBalance(cm.address)
  // console.log('contract ETH balance: ', balance);
  await tokenAddress.transfer(channelManager.address, web3.utils.toWei(tokens))
  // balance = await hst.balanceOf(cm.address)
  // console.log('contract HST balance: ', balance);
}

// NOTE : ganache-cli -m 'refuse result toy bunker royal small story exhaust know piano base stand'
// NOTE : hub : accounts[0], privKeys[0]
let channelManager, tokenAddress, challengePeriod
let hub, performer, viewer, someone, initChannel, initThread, dummyThreadState

contract("ChannelManager", accounts => {
  let snapshotId

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()

    hub = {
      address: accounts[0],
      privateKey: privKeys[0]
    }
    console.log(hub)
    performer = {
      address: accounts[1],
      privateKey: privKeys[1]
    }
    viewer = {
      address: accounts[2],
      privateKey: privKeys[2]
    }
    someone = {
      address: accounts[3],
      privateKey: privKeys[3]
    }

    await fundContract("5", "1000")
  })

  beforeEach(async () => {
    snapshotId = await snapshot()
    initChannel = {
      "user": performer.address,
      "recipient": performer.address,
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "pendingWeiUpdates": [0, 0, 0, 0],
      "pendingTokenUpdates": [0, 0, 0, 0],
      "txCount": [1, 1],
      "threadRoot": emptyRootHash,
      "threadCount": 0,
      "timeout": 0
    }
    dummyThreadState = {
      "contractAddress": channelManager.address,
      "sender": viewer.address,
      "receiver": performer.address,
      "threadId": 1,
      "balanceWeiSender": 0,
      "balanceWeiReceiver": 0,
      "balanceTokenSender": 0,
      "balanceTokenReceiver": 0,
      "txCount": 0
    }
    /*
    initThread = {
      "user": viewer.address,
      "sender": viewer.address,
      "receiver": performer.address,
      "threadId": 1,
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "txCount": 0,
      "updatedWeiBalances": [0, 0],
      "updatedTokenBalances": [0, 0],
      "updatedTxCount": 0,
      "proof": await generateThreadProof(dummyThreadState, [dummyThreadState]),
      "sig": "0x0",
      "updateSig": "0x0"
    }*/
  })

  afterEach(async () => {
    await restore(snapshotId)
  })

  async function ffThreadDispute() {
    // get some wei into the channel
    initChannel.user = viewer.address
    initChannel.pendingWeiUpdates = [100, 0, 100, 0]
    initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
    await userAuthorizedUpdate(initChannel, viewer, 100)

    // initChannel -> initChannel (balances updated to account for thread
    // opening)
    //
    // initialize thread state (using the same balance diff as the channel)
    // channel.openThread(sender, receiver, balanceWei, balanceToken)
    // -> channel

    // prepare channel update that contains thread ...
    initChannel.weiBalances = [100, 90]
    initChannel.pendingWeiUpdates = [0, 0, 0, 0]
    initChannel.txCount = [2, 2]

    const threadInitialState = {
      "contractAddress": channelManager.address,
      "sender": viewer.address,
      "receiver": performer.address,
      "threadId": 1,
      "balanceWeiSender": 10,
      "balanceWeiReceiver": 0,
      "balanceTokenSender": 0,
      "balanceTokenReceiver": 0,
      "txCount": 0
    }
    initChannel.threadRoot = await generateThreadRootHash([threadInitialState])
    initThread.proof = await generateThreadProof(threadInitialState, [threadInitialState])
    initChannel.threadCount = 1

    initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
    initChannel.sigUser = await signChannelState(initChannel, viewer.privateKey)


    // ... and start exit with that
    await startExitWithUpdate(initChannel, viewer.address)

    // wait ...
    await moveForwardSecs(config.timeout + 1)

    // ... and empty channel
    await channelManager.emptyChannel(viewer.address)
  }

  async function ffStartedExitThreadWithUpdate() {
    // fast-forward channel to thread dispute state
    await ffThreadDispute()

    // prepare initial thread state
    initThread.weiBalances = [10, 0]
    initThread.sig = await signThreadState(initThread, viewer.privateKey)

    // prepare updated thread state ...
    initThread.updatedWeiBalances = [7, 3]
    initThread.updatedTxCount = 1
    initThread.updateSig = await signThreadUpdate(initThread, viewer.privateKey)

    // ... and start exit with that
    await startExitThreadWithUpdate(initThread, viewer.address)
  }

  describe('contract deployment', () => {
    it("verify initialized parameters", async () => {
      const approvedToken = await channelManager.approvedToken()
      challengePeriod = await channelManager.challengePeriod()

      assert.equal(hub.address, accounts[0])
      assert.equal(challengePeriod.toNumber(), config.timeout)
      assert.equal(approvedToken, tokenAddress.address)
    })
  })

  describe('hubContractWithdraw', () => {
    it("happy case", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('1'),
        web3.utils.toWei('1')
      )
    })

    it("fails with insufficient ETH", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('6'),
        web3.utils.toWei('1')
      )
        .should
        .be
        .rejectedWith(
          'hubContractWithdraw: Contract wei funds not sufficient to withdraw'
        )
    })

    it("fails with insufficient tokens", async () => {
      await channelManager.hubContractWithdraw(
        web3.utils.toWei('1'),
        web3.utils.toWei('1001')
      )
        .should
        .be
        .rejectedWith(
          'hubContractWithdraw: Contract token funds not sufficient to withdraw'
        )
    })
  })

  describe('hubAuthorizedUpdate', () => {
    it("happy case", async () => {

      connext = new Connext({
        web3,
        hubUrl: process.env.HUB_URL || '',
        contractAddress: process.env.CONTRACT_ADDRESS || '',
        hubAddress: process.env.HUB_ADDRESS || '',
        tokenAddress: process.env.TOKEN_ADDRESS,
      })

      // initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      // await hubAuthorizedUpdate(initChannel)
    })

    // TODO write tests based on:
    // https://github.com/ConnextProject/contracts/blob/master/docs/aggregateUpdates.md
    // 1. user deposit
    // 2. hub deposit
    // 3. user withdrawal
    // 4. hub withdrawal
    // 5. user deposit + hub deposit
    // 6. user deposit + hub withdrawal
    // 7. user withdrawal + hub deposit
    // 8. user w + hub w
    // 9. actual exchange scenarios
    //    - performer withdrawal booty -> eth
    //      - also hub withdraws collateral
    //    - user withdrawal booty -> eth
    //      - also hub withdraws collateral
    // 10. recipient is different than user
    //
    // State Transitions:
    // 1. channelBalances (wei / token)
    // 2. totalChannelWei
    // 3. totalChannelToken
    // 4. channel.weiBalances[2]
    // 5. channel.tokenBalances[2]
    // 6. recipient ether balance
    // 7. recipient token balance
    // 8. contract eth/token balance (reserve)
    // 9. txCount
    // 10. threadRoot
    // 11. threadCount
    // 12. event
    //
    // TODO
    // test modifiers
    // 1. onlyHub

    it("fails user withdrawal with empty channel and pending wei updates", async () => {
      initChannel.pendingWeiUpdates = [0, 0, 0, 1]
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await hubAuthorizedUpdate(initChannel)
        .should
        .be
        .rejectedWith('Returned error: VM Exception while processing transaction: revert')
    })

    it("fails with invalid user signature", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid signature
      initChannel.sigUser = '0x0'
      // attempt update
      await hubAuthorizedUpdate(initChannel)
        .should.be.rejectedWith('user signature invalid')
    })

    it("fails on non-open channel", async () => {
      // set status to ChannelDispute
      await channelManager.startExit(accounts[1])
      // attempt update
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await hubAuthorizedUpdate(initChannel)
        .should.be.rejectedWith('channel must be open')
    })
  })

  describe.only('userAuthorizedUpdate', () => {
    it("happy case", async () => {
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      console.log(await recover(initChannel, initChannel.sigHub))
      console.log(hub.address)
      await userAuthorizedUpdate(initChannel, performer)
    })

    it("fails when wei deposit value not equal to message value", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid deposit amount in wei
      initChannel.pendingWeiUpdates[2] = web3.utils.toWei('1')
      // set sig
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should.be.rejectedWith('msg.value is not equal to pending user deposit')
    })

    it("fails token deposit for user without tokens", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid deposit amount in tokens
      initChannel.pendingTokenUpdates[2] = web3.utils.toWei('1')
      // set sig
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should.be.rejectedWith(
          'Returned error: VM Exception while processing transaction: revert'
        )
    })

    it("fails with invalid hub signature", async () => {
      // increment global txCount
      initChannel.txCount[0] = 2
      // set invalid signature
      initChannel.sigHub = '0x0'
      // attempt update
      await userAuthorizedUpdate(initChannel, performer)
        .should.be.rejectedWith('hub signature invalid')
    })
  })

  describe('startExit', () => {
    it("fails when user == hub", async () => {
      await channelManager.startExit(hub.address)
        .should.be.rejectedWith('user can not be hub')
    })

    it("fails when user == contract", async () => {
      await channelManager.startExit(channelManager.address)
        .should.be.rejectedWith('user can not be channel manager')
    })

    it("fails when sender not hub or user", async () => {
      await channelManager.startExit(
        performer.address,
        { from: viewer.address }
      )
        .should.be.rejectedWith('exit initiator must be user or hub')
    })

    it("happy case", async () => {
      await channelManager.startExit(performer.address)
    })

    it("fails when channel.status != Open", async () => {
      await channelManager.startExit(performer.address)
      await channelManager.startExit(performer.address)
        .should.be.rejectedWith('channel must be open')
    })
  })

  describe('startExitWithUpdate', () => {
    it("fails when sender not hub or user", async () => {
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)

      await startExitWithUpdate(initChannel, viewer.address)
        .should.be.rejectedWith('exit initiator must be user or hub')
    })

    it("fails when timeout != 0", async () => {
      initChannel.timeout = 1
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)

      await startExitWithUpdate(initChannel, hub.address)
        .should.be.rejectedWith('can\'t start exit with time-sensitive states')
    })

    it("happy case", async () => {
      initChannel.user = performer.address
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await startExitWithUpdate(initChannel, hub.address)
    })

    it("fails when channel.status != Open", async () => {
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await channelManager.startExit(performer.address) // channel.status = Status.ChannelDispute
      await startExitWithUpdate(initChannel, hub.address)
        .should
        .be
        .rejectedWith('channel must be open')
    })
  })

  describe('emptyChannelWithChallenge', () => {
    it("happy case", async() => {
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await channelManager.startExit(performer.address, { from: hub.address })
      await emptyChannelWithChallenge(initChannel, performer.address)
    })
  })

  describe('emptyChannel', () => {
    it("happy case", async () => {
      await channelManager.startExit(performer.address)
      await moveForwardSecs(config.timeout + 1)
      await channelManager.emptyChannel(performer.address)
    })

    // TODO
    // Global Process:
    // 1. For each function write down every state change
    // 2. Test each successful state change
    // 3. Test all logical branches (both sides of an if)
    // 4. refactor to add helper functions for verification
    //
    // EXAMPLE: emptyChannel
    // 1. channel.weiBalances[2]
    // 2. channel.tokenBalances[2]
    // 3. totalChannelWei
    // 4. totalChannelToken
    // 5. user ETH balance
    // 6. contract ETH balance -> reserves
    // 7. user token balance
    // 8. contract token balance -> reserves
    // 9. channel.weiBalances[0, 1] = 0
    // 10. channel.tokenBalances[0, 1] = 0
    // 11. channe.threadClosingTime
    // 12. channel.status
    // 13. channel.exitInitiator
    // 14. channel.channelClosingTime
    // 15. event
    //
    // 0. happy case - emptyChannel with zero threadCount (default)
    // - check 1-15
    // 1. emptyChannel after hubAuthorizedUpdate
    // - check 1-15 (different balance)
    // 2. emptyChannel after userAuthorizedUpdate
    // - check 1-15 (different balance)
    // 3. emptyChannel with non-zero threadCount
    // - check 1-15 (thread dispute, thread closing time updated)
    // 4. emptyChannel after startExitWithUpdate


    it("fails when channel not in dispute", async () => {
      await channelManager.emptyChannel(performer.address)
        .should.be.rejectedWith('channel must be in dispute')
    })

    it("fails when channel closing time not passed", async () => {
      await channelManager.startExit(performer.address)
      await channelManager.emptyChannel(performer.address)
        .should.be.rejectedWith('channel closing time must have passed')
    })
  })

  describe('startExitThread', () => {
    it("happy case", async() => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // prepare initial thread state ...
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // ... and start exit with that
      await startExitThread(initThread, viewer.address)
    })

    it("fails when channel not in thread dispute", async () => {
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('channel must be in thread dispute phase')
    })

    it("fails when msg.sender is neither hub nor user", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      await startExitThread(initThread, performer.address)
        .should.be.rejectedWith('thread exit initiator must be user or hub')
    })

    it("fails when user is neither sender nor receiver", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = someone.address
      initThread.receiver = someone.address
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('user must be thread sender or receiver')
    })

    it("fails when initial receiver wei balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.weiBalances[1] = 1
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when initial receiver token balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.tokenBalances[1] = 1
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when thread closing time is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // prepare initial thread state ...
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // ... and start exit with that
      await startExitThread(initThread, viewer.address)

      // try to start exit once again
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('thread closing time must be zero')
    })

    it("fails when sender and receiver are the same", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = initThread.sender
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('sender can not be receiver')
    })

    it("fails when sender is hub", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = hub.address
      initThread.receiver = initThread.user
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('hub can not be sender or receiver')
    })

    it("fails when receiver is hub", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = hub.address
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('hub can not be sender or receiver')
    })

    it("fails when sender is contract", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = channelManager.address
      initThread.receiver = initThread.user
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('channel manager can not be sender or receiver')
    })

    it("fails when receiver is contract", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = channelManager.address
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('channel manager can not be sender or receiver')
    })

    it("fails when initial thread state and signature don't match", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // real initial state that was included in channel's thread root
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.weiBalances = [69, 0]
      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('signature invalid')
    })

    it("fails when initial thread state isn't included in channel's threadRoot", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // fake initial state -- was not included in channel's thread root
      initThread.weiBalances = [69, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      await startExitThread(initThread, viewer.address)
        .should.be.rejectedWith('initial thread state is not contained in threadRoot')
    })
  })

  describe('startExitThreadWithUpdate', () => {
    it("happy case", async() => {
      await ffStartedExitThreadWithUpdate()
    })

    it("fails when channel not in thread dispute", async () => {
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('channel must be in thread dispute phase')
    })

    it("fails when msg.sender is neither hub nor user", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      await startExitThreadWithUpdate(initThread, performer.address)
        .should.be.rejectedWith('thread exit initiator must be user or hub')
    })

    it("fails when user is neither sender nor receiver", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = someone.address
      initThread.receiver = someone.address
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('user must be thread sender or receiver')
    })

    it("fails when initial receiver wei balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.weiBalances[1] = 1
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when initial receiver token balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.tokenBalances[1] = 1
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when thread closing time is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // prepare initial thread state ...
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // ... and start exit with that
      await startExitThread(initThread, viewer.address)

      // try to start exit once again
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('thread closing time must be zero')
    })

    it("fails when sender and receiver are the same", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = initThread.sender
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('sender can not be receiver')
    })

    it("fails when sender is hub", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = hub.address
      initThread.receiver = initThread.user
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('hub can not be sender or receiver')
    })

    it("fails when receiver is hub", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = hub.address
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('hub can not be sender or receiver')
    })

    it("fails when sender is contract", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = channelManager.address
      initThread.receiver = initThread.user
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('channel manager can not be sender or receiver')
    })

    it("fails when receiver is contract", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.receiver = channelManager.address
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('channel manager can not be sender or receiver')
    })

    it("fails when initial thread state and signature don't match", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // real initial state that was included in channel's thread root
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.weiBalances = [69, 0]
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('signature invalid')
    })

    it("fails when initial thread state isn't included in channel's threadRoot", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // fake initial state -- was not included in channel's thread root
      initThread.weiBalances = [69, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('initial thread state is not contained in threadRoot')
    })

    it("fails when updatedTxCount is zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // initial state
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.updatedTxCount = 0
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('updated thread txCount must be higher than 0')
    })

    it("fails when sum of updated wei balances doesn't match initial sender wei balance", async () => {
      // TODO (possibly): The same for token

      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // initial state
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.updatedWeiBalances = [7, 4]
      initThread.updatedTxCount = 1
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('updated wei balances must match sum of initial wei balances')
    })

    it("fails when balances in updated state are the same as in initial state", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // initial state
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.updatedWeiBalances = [10, 0]
      initThread.updatedTxCount = 1
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('receiver balances may never decrease and either wei or token balance must strictly increase')
    })

    it("fails when updated thread state and signature don't match", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // initial state
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // signed updated state
      initThread.updatedWeiBalances = [69, 3]
      initThread.updatedTxCount = 1
      initThread.updatedSig = await signThreadUpdate(initThread, viewer.privateKey)

      // real updated state
      initThread.updatedWeiBalances = [7, 3]
      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('signature invalid')
    })

    it("fails when initial thread state isn't included in channel's threadRoot", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // fake initial state -- was not included in channel's thread root
      initThread.weiBalances = [69, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      await startExitThreadWithUpdate(initThread, viewer.address)
        .should.be.rejectedWith('initial thread state is not contained in threadRoot')
    })
  })

  describe('challengeThread', () => {
    it("happy case", async() => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // performer challenges with more recent thread state
      initThread.weiBalances = [2, 8]
      initThread.txCount = 2
      initThread.sig = await signThreadState(initThread, viewer.privateKey)
      await challengeThread(initThread, performer.address)
    })

    it("fails when msg.sender is neither hub nor sender nor receiver", async () => {
      // fast-forward thread to started exit
      await ffThreadDispute()

      await challengeThread(initThread, someone.address)
        .should.be.rejectedWith('only hub, sender, or receiver can call this function')
    })

    it("fails when thread closing time has passed", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // wait until threadClosingTime has passed
      await moveForwardSecs(config.timeout + 1)

      await challengeThread(initThread, viewer.address)
        .should.be.rejectedWith('thread closing time must not have passed')
    })

    it("fails when txCount is not higher than onchain txCount", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      initThread.txCount = 0

      await challengeThread(initThread, viewer.address)
        .should.be.rejectedWith('thread txCount must be higher than the current thread txCount')
    })

    it("fails when sum of wei balances doesn't match sum of onchain wei balances", async () => {
      // TODO (possibly): The same for token

      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      initThread.weiBalances = [7, 4]
      initThread.txCount = 2
      await challengeThread(initThread, viewer.address)
        .should.be.rejectedWith('updated wei balances must match sum of thread wei balances')
    })

    it("fails when balances are the same as in onchain state", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      initThread.weiBalances = [7, 3]
      initThread.txCount = 2
      await challengeThread(initThread, viewer.address)
        .should.be.rejectedWith('receiver balances may never decrease and either wei or token balance must strictly increase')
    })

    it("fails when thread state and signature don't match", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // real thread state
      initThread.weiBalances = [69, 3]
      initThread.txCount = 2
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.weiBalances = [5, 5]
      await challengeThread(initThread, viewer.address)
        .should.be.rejectedWith('signature invalid')
    })
  })

  describe('emptyThread', () => {
    it("happy case", async() => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // prepare performer channel for emptyThread
      initChannel.user = performer.address
      initChannel.weiBalances = [0, 0]
      initChannel.pendingWeiUpdates = [200, 0, 50, 0]
      initChannel.txCount = [1, 1]
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      await userAuthorizedUpdate(initChannel, performer, 50)
      initChannel.weiBalances = [190, 50]
      initChannel.pendingWeiUpdates = [0, 0, 0, 0]
      initChannel.txCount = [2, 2]
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, performer.privateKey)
      await startExitWithUpdate(initChannel, performer.address)
      await moveForwardSecs(config.timeout + 1)
      await channelManager.emptyChannel(performer.address)

      // wait until we can empty
      await moveForwardSecs(config.timeout + 1)

      // prepare initial thread state
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // viewer empties
      await emptyThread(initThread, viewer.address)

      // performer empties
      initThread.user = performer.address
      await emptyThread(initThread, performer.address)
    })

    it("fails when channel not in thread dispute", async () => {
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('channel must be in thread dispute')
    })

    it("fails when msg.sender is neither hub nor user", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      await emptyThread(initThread, performer.address)
        .should.be.rejectedWith('thread exit initiator must be user or hub')
    })

    it("fails when user is neither sender nor receiver", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.sender = someone.address
      initThread.receiver = someone.address
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('user must be thread sender or receiver')
    })

    it("fails when initial receiver wei balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.weiBalances[1] = 1
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when initial receiver token balance is not zero", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      initThread.tokenBalances[1] = 1
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('initial receiver balances must be zero')
    })

    it("fails when thread closing time hasn't passed yet", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('Thread closing time must have passed')
    })

    // TODO: fails when same user tries to empty twice -- quite laborious,
    // because we need a second thread to keep the channel in ThreadDispute
    // after emptying.

    it("fails when same user tries to empty twice", async () => {
      // get some wei into the channel
      initChannel.user = viewer.address
      initChannel.pendingWeiUpdates = [100, 0, 100, 0]
      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      await userAuthorizedUpdate(initChannel, viewer, 100)

      // prepare channel update that contains 2 thread ...
      initChannel.weiBalances = [100, 70]
      initChannel.pendingWeiUpdates = [0, 0, 0, 0]
      initChannel.txCount = [3, 3]

      const thread1InitialState = {
        "contractAddress": channelManager.address,
        "sender": viewer.address,
        "receiver": performer.address,
        "threadId": 1,
        "balanceWeiSender": 10,
        "balanceWeiReceiver": 0,
        "balanceTokenSender": 0,
        "balanceTokenReceiver": 0,
        "txCount": 0
      }

      const thread2InitialState = {
        "contractAddress": channelManager.address,
        "sender": viewer.address,
        "receiver": someone.address,
        "threadId": 1,
        "balanceWeiSender": 20,
        "balanceWeiReceiver": 0,
        "balanceTokenSender": 0,
        "balanceTokenReceiver": 0,
        "txCount": 0
      }

      initChannel.threadRoot = await generateThreadRootHash([thread1InitialState, thread2InitialState])
      initThread.proof = await generateThreadProof(thread1InitialState, [thread1InitialState, thread2InitialState])
      initChannel.threadCount = 2 // well, I guess we could have just faked that number into the channel state, without actually including a second thread in the merkle root

      initChannel.sigHub = await signChannelState(initChannel, hub.privateKey)
      initChannel.sigUser = await signChannelState(initChannel, viewer.privateKey)

      await startExitWithUpdate(initChannel, viewer.address)

      // wait ...
      await moveForwardSecs(config.timeout + 1)

      // ... and empty channel
      await channelManager.emptyChannel(viewer.address)

      // prepare initial state for thread1
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      // start exit thread1 with initial state
      await startExitThread(initThread, viewer.address)

      // wait ...
      await moveForwardSecs(config.timeout + 1)

      // ... and empty thread
      await emptyThread(initThread, viewer.address)

      // finally, try to empty a second time
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('user cannot empty twice')
    })

    it("fails when initial thread state and signature don't match", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // wait for thread closing time to pass
      await moveForwardSecs(config.timeout + 1)

      // real initial state that was included in channel's thread root
      initThread.weiBalances = [10, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      initThread.weiBalances = [69, 0]
      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('signature invalid')
    })

    it("fails when initial thread state isn't included in channel's threadRoot", async () => {
      // fast-forward thread to started exit
      await ffStartedExitThreadWithUpdate()

      // wait for thread closing time to pass
      await moveForwardSecs(config.timeout + 1)

      // fake initial state -- was not included in channel's thread root
      initThread.weiBalances = [69, 0]
      initThread.sig = await signThreadState(initThread, viewer.privateKey)

      await emptyThread(initThread, viewer.address)
        .should.be.rejectedWith('initial thread state is not contained in threadRoot')
    })

    // These should not be possible:
    // * fails when sum of onchain wei balances doesn't match initial wei balances
    // * fails when sum of onchain token balances doesn't match initial token balances
    // * fails when receiver's onchain wei or token balance is less than in initial state
  })

  describe('nukeThreads', () => {
    it("happy case", async() => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // wait until we can nuke
      await moveForwardSecs(10 * config.timeout + 1)

      // nuke
      await nukeThreads(initThread, performer.address)
    })

    it("fails when user == hub", async () => {
      initChannel.user = hub.address
      await nukeThreads(initChannel, viewer.address)
        .should.be.rejectedWith('user can not be hub')
    })

    it("fails when user == contract", async () => {
      initChannel.user = channelManager.address
      await nukeThreads(initChannel, viewer.address)
        .should.be.rejectedWith('user can not be channel manager')
    })

    it("fails when channel not in thread dispute", async () => {
      await nukeThreads(initChannel, viewer.address)
        .should.be.rejectedWith('channel must be in thread dispute')
    })

    it("fails when we're not past 10 challenge periods after channelClosingTime", async () => {
      // fast-forward channel to thread dispute state
      await ffThreadDispute()

      // wait only for 9 challenge periods
      await moveForwardSecs(9 * config.timeout)

      await nukeThreads(initChannel, viewer.address)
        .should.be.rejectedWith('channel closing time must have passed by 10 challenge periods')
    })
  })
})

async function recover(state, sig) {
  let fingerprint = await makeHash(state)
  console.log('og hash')
  console.log(fingerprint)
  fingerprint = ethjsUtil.toBuffer(String(fingerprint))
  console.log('buffer fingerprint')
  console.log(fingerprint)
  const prefix = ethjsUtil.toBuffer('\x19Ethereum Signed Message:\n')
  const prefixedMsg = ethjsUtil.keccak256(
    Buffer.concat([
      prefix,
      ethjsUtil.toBuffer(String(fingerprint.length)),
      fingerprint,
    ]),
  )
  console.log('prefixed')
  console.log(prefixedMsg)
  const res = ethjsUtil.fromRpcSig(sig)
  const pubKey = ethjsUtil.ecrecover(
    // ethjsUtil.toBuffer(prefixedMsg),
    fingerprint,
    res.v,
    res.r,
    res.s,
  )
  const addrBuf = ethjsUtil.pubToAddress(pubKey)
  const addr = ethjsUtil.bufferToHex(addrBuf)
  return addr
}

async function makeHash(data) {
  const hash = await web3.utils.soliditySha3(
    channelManager.address,
    {type: 'address[2]', value: [data.user, data.recipient]},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256[4]', value: data.pendingWeiUpdates},
    {type: 'uint256[4]', value: data.pendingTokenUpdates},
    {type: 'uint256[2]', value: data.txCount},
    {type: 'bytes32', value: data.threadRoot},
    data.threadCount,
    data.timeout
  )
  return hash
}
