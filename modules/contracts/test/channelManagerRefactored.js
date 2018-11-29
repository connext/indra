"use strict";
const HttpProvider = require(`ethjs-provider-http`)
const EthRPC = require(`ethjs-rpc`)
const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const Utils = require("./helpers/utils");
const Ledger = artifacts.require("./ChannelManager.sol");
const EC = artifacts.require("./ECTools.sol");
const Token = artifacts.require("./lib/HumanStandardToken.sol");
const Connext = require("../client/dist/Utils.js");
const privKeys = require("./privKeys.json")


const config = require("../config.json")

const should = require("chai")
  .use(require("chai-as-promised"))
  .should();

const SolRevert = "VM Exception while processing transaction: revert";

const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

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
  while (Date.now() < start + 300) {}
  await ethRPC.sendAsync({method: `evm_mine`}, (err)=> {});
  while (Date.now() < start + 300) {}
  return true
}



async function generateThreadProof(threadHashToProve, threadInitStates) {
  return await Connext.Utils.generateThreadProof(threadHashToProve, threadInitStates)
}

async function generateThreadRootHash(threadInitStates){
  return await Connext.Utils.generateThreadRootHash([threadInitStates])
}

function getEventParams(tx, event) {
  if (tx.logs.length > 0) {
    for (let idx=0; idx < tx.logs.length; idx++) {
      if (tx.logs[idx].event == event) {
        return tx.logs[idx].args
      }
    }
  }
  return false
}

async function updateHash(data, privateKey) {
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

async function updateThreadHash(data, privateKey) {
  const hash = await web3.utils.soliditySha3(
    channelManager.address,
    {type: 'address', value: data.user},
    {type: 'address', value: data.sender},
    {type: 'address', value: data.receiver},
    {type: 'uint256[2]', value: data.weiBalances},
    {type: 'uint256[2]', value: data.tokenBalances},
    {type: 'uint256', value: data.txCount}
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
    data.weiBalances,
    data.tokenBalances,
    data.txCount,
    data.proof,
    data.sig,
    {from: user}
  )
}

async function startExitThreadWithUpdate(data, user) {
    await channelManager.startExitThreadWithUpdate(
        data.user,
        [data.sender, data.receiver],
        data.weiBalances,
        data.tokenBalances,
        data.txCount,
        data.proof,
        data.sig,
        data.updatedWeiBalances,
        data.updatedTokenBalances,
        data.updatedTxCount,
        data.updateSig,
        {from: user}
    )
}

async function emptyThread(data) {
    await channelManager.emptyThread(
        data.user,
        data.sender,
        data.receiver
    )
}

async function fastEmptyThread(data, user) {
    await channelManager.fastEmptyThread(
        data.user,
        data.sender,
        data.receiver,
        data.weiBalances,
        data.tokenBalances,
        data.txCount,
        data.sig,
        {from:user}
    )
}

// NOTE : ganache-cli -m 'refuse result toy bunker royal small story exhaust know piano base stand'

// NOTE : hub : accounts[0], privKeys[0]

let channelManager, tokenAddress, hubAddress, challengePeriod, approvedToken
let hub, performer, viewer, init

contract("ChannelManager", accounts => {
    let snapshotId

    before('deploy contracts', async () => {
        channelManager = await Ledger.deployed()
        tokenAddress = await Token.deployed()

        hub = {
            address: accounts[0],
            privateKey : privKeys[0]
        }
        performer = {
            address: accounts[1],
            privateKey : privKeys[1]
        }
        viewer = {
            address: accounts[2],
            privateKey : privKeys[2]
        }
    })

    beforeEach(async () => {
        snapshotId = await snapshot()
        init = {
            "hub": hub.address,
            "user" : viewer.address,
            "sender" : viewer.address,
            "receiver" : performer.address,
            "recipient" : performer.address,
            "weiBalances" : [0, 0],
            "tokenBalances" : [0, 0],
            "pendingWeiUpdates" : [0, 0, 0, 0],
            "pendingTokenUpdates" : [0, 0, 0, 0],
            "txCount" : [1,1],
            "threadRoot" : emptyRootHash,
            "threadCount" : 0,
            "timeout" : 0,
            "proof" : await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : hub.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 0,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
        }
    })
    afterEach(async () => {
        await restore(snapshotId)
    })

    describe('fastEmptyThread', () => {
        it.only("happy case", async() => {
            tokenAddress.approve(channelManager.address, 100, {from: hub.address})
            tokenAddress.transfer(channelManager.address, 100, {from: hub.address})
            const weiDeposit = 100
            init.receiver = hub.address
            init.recipient = hub.address
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.pendingTokenUpdates = [100,0,0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : hub.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 100,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            // channel must be in thread dispute phase
            console.log('viewer wei channel before empty channel', await channelManager.getWeiBalances(viewer.address))
            // console.log('viewer wei channel after emptyChannel', await 
            //channelManager.getWeiBalances(viewer.address)
            
            init.txCount = 2
            init.weiBalances = [100,0]
            init.tokenBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, hub.address)
                    
            init.txCount = 3
            // TODO : increase tokens
            init.weiBalances = [90,10]
            init.tokenBalances = [90,10]
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await fastEmptyThread(init, hub.address)
        })
    })

    describe('startExitThreadWithUpdate', () => {
        it("happy case", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            tokenAddress.approve(hub.address, 100, {from: viewer.address})
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address)
        })

        it("FAIL: channel not in thread dispute phase", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : hub.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            // await channelManager.emptyChannel(viewer.address)
            init.txCount = 2

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 3
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 3
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith('channel must be in thread dispute phase')
        })

        it("FAIL: channel not in thread dispute", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            // await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("channel must be in thread dispute phase")
        })

        it("FAIL: not user or hub", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, performer.address).should.be.rejectedWith("thread exit initiator must be user or hub")
        })

        it("FAIL: already in dispute", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("thread must not already be in dispute")
        })

        it("FAIL: thread txCount not higher than current", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 0
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 0
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("updated thread txCount must be higher than the initial thread txCount")
        })

        it("FAIL: updated thread txCount not higher than initial thread txCount", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 0

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("thread txCount must be higher than the current thread txCount")
        })

        it("FAIL: updated wei balances not match", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [0,0]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("updated wei balances must match sum of initial wei balances")
        })

        it("FAIL: updated token balances must match sum", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [90,10]
            init.updatedTokenBalances = [100,100]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [90,10],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith("updated token balances must match sum of initial token balances")
        })

        it("FAIL: receiver wei not increasing", async() => {
            // user deposit
            const weiDeposit = 100
            init.pendingWeiUpdates = [weiDeposit,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.proof = await generateThreadRootHash({
                "contractAddress" : channelManager.address,
                "user" : viewer.address,
                "sender" : viewer.address,
                "receiver" : performer.address,
                "balanceWeiSender" : 100,
                "balanceWeiReceiver" : 0,
                "balanceTokenSender" : 0,
                "balanceTokenReceiver" : 0,
                "txCount" : 2
            })
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 3

            // TODO : increase tokens
            init.weiBalances = [100,0]
            init.sig = await updateThreadHash(init, viewer.privateKey)

            init.updatedWeiBalances = [100,0]
            init.updatedTokenBalances = [0,0]
            init.updatedTxCount = 4
            init.updateSig = await updateThreadHash({
                user: viewer.address,
                sender: viewer.address,
                receiver: performer.address,
                weiBalances: [100,0],
                tokenBalances: [0,0],
                txCount: 4
            }, viewer.privateKey)
            await startExitThreadWithUpdate(init, viewer.address).should.be.rejectedWith('receiver wei balance must always increase')
        })
    })

    describe('emptyThread', () => {
        it("happy case", async() => {
            await tokenAddress.transfer(channelManager.address, 100)
            await tokenAddress.approve(hub.address, 100)
            init.threadCount = 1
            init.pendingTokenUpdates = [100,0,0,0]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await emptyThread(init)
        })

        it("FAIL: channel not in thread dispute", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await emptyThread(init)
            await emptyThread(init).should.be.rejectedWith('channel must be in thread dispute')
        })

        it("FAIL: thread closing time not passed", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
            await emptyThread(init).should.be.rejectedWith('thread closing time must have passed')
        })

        it("FAIL: thread not in dispute", async() => {
            init.threadCount = 2
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await emptyThread(init)
            await emptyThread(init).should.be.rejectedWith('thread must be in dispute')
        })
    })

    describe('startExitThread', () => {
        it("happy case", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
        })

        it("FAIL: not in thread dispute", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address).should.be.rejectedWith('channel must be in thread dispute phase')
        })

        it("FAIL: exit initiator not user or hub", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, performer.address).should.be.rejectedWith('thread exit initiator must be user or hub')
        })

        it("FAIL: thread not already in dispute", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address)
            await startExitThread(init, viewer.address).should.be.rejectedWith('thread must not already be in dispute')
        })

        it("FAIL: txCount not higher", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 0
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address).should.be.rejectedWith('thread txCount must be higher than the current thread txCount')
        })

        it("FAIL: _verifyThread - sender can not be receiver", async() => {
            init.threadCount = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sender = viewer.address
            init.receiver = viewer.address
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address).should.be.rejectedWith('sender can not be receiver')
        })

        it("thread not contained in threadRoot", async() => {
            init.threadCount = 1
            init.threadRoot = "0x0000000000000000000000000000000000000000000000000000000000000001"
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            await channelManager.startExit(viewer.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(viewer.address)
            init.txCount = 2
            init.sig = await updateThreadHash(init, viewer.privateKey)
            await startExitThread(init, viewer.address).should.be.rejectedWith('initial thread state is not contained in threadRoot')
        })
    })

    describe('nukeThreads', () => {
        it("happy case", async() => {
            const weiDeposit = 100
            init.pendingWeiUpdates = [0,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)

            await channelManager.startExit(viewer.address)

            init.txCount = [2,1]
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await emptyChannelWithChallenge(init, viewer.address)
            await moveForwardSecs(config.timeout * 11)
            await channelManager.nukeThreads(viewer.address)
        })

        it("FAIL : channel not in thread dispute ", async() => {
            const weiDeposit = 100
            init.pendingWeiUpdates = [0,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)

            await channelManager.startExit(viewer.address)
            await channelManager.nukeThreads(viewer.address).should.be.rejectedWith('channel must be in thread dispute')
        })

        it("FAIL : channel not passed 10x challenge periods", async() => {
            const weiDeposit = 100
            init.pendingWeiUpdates = [0,0,weiDeposit,0]
            init.tokenBalances = [0,0]
            init.threadCount = 1
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)

            await channelManager.startExit(viewer.address)

            init.txCount = [2,1]
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await emptyChannelWithChallenge(init, viewer.address)
            await channelManager.nukeThreads(viewer.address).should.be.rejectedWith('thread closing time must have passed by 10 challenge periods')
        })
    })

   describe('emptyChannelWithChallenge', () => {
    it("happy case", async() => {
        const weiDeposit = 100
        init.pendingWeiUpdates = [0,0,weiDeposit,0]
        init.tokenBalances = [0,0]
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await userAuthorizedUpdate(init, viewer, weiDeposit)

        await channelManager.startExit(viewer.address)

        init.txCount = [2,1]
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await emptyChannelWithChallenge(init, viewer.address)
      })

    it("FAIL: channel not in dispute", async() => {
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('channel must be in dispute')
    })

    it("FAIL: channel timeout", async() => {
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await channelManager.startExit(viewer.address)
        await moveForwardSecs(config.timeout + 1)
        await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('channel closing time must not have passed')
    })

    it("FAIL: challenger is exit initiator", async() => {
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await channelManager.startExit(viewer.address, {from: viewer.address})
        await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('challenger can not be exit initiator')
    })

    it("FAIL: challenger either user or hub", async() => {
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await channelManager.startExit(viewer.address, {from: viewer.address})
        await emptyChannelWithChallenge(init, performer.address).should.be.rejectedWith('challenger must be either user or hub')
    })

    it("FAIL: non-zero timeout", async() => {
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        init.timeout = 1
        await channelManager.startExit(viewer.address, {from: viewer.address})
        await emptyChannelWithChallenge(init, hub.address).should.be.rejectedWith('can\'t start exit with time-sensitive states')
    })

    it("FAIL: global txCount", async() => {
        init.txCount = [1,1]
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await hubAuthorizedUpdate(init, hub.address)
        await channelManager.startExit(viewer.address)
        await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('global txCount must be higher than the current global txCount')
    })

    it("FAIL: onchain txCount", async() => {
        const weiDeposit = 1
        init.sigUser = await updateHash(init, viewer.privateKey)
        await hubAuthorizedUpdate(init)

        init.txCount = [2,2]
        init.pendingWeiUpdates = [0,0,weiDeposit,0]
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await userAuthorizedUpdate(init, viewer, weiDeposit)

        init.txCount = [3,1]
        init.pendingWeiUpdates = [0,0,weiDeposit,0]
        init.sigHub = await updateHash(init, hub.privateKey)
        init.sigUser = await updateHash(init, viewer.privateKey)
        await channelManager.startExit(viewer.address)
        await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
    })

    it("FAIL: wei conservation", async() => {
      init.txCount = [2,1]
      init.weiBalances = [0,1]
      init.sigHub = await updateHash(init, hub.privateKey)
      init.sigUser = await updateHash(init, viewer.privateKey)
      await channelManager.startExit(viewer.address)
      await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('wei must be conserved')
    })

    it("FAIL: tokens conservation", async() => {
      init.txCount = [2,1]
      init.tokenBalances = [0,1]
      init.sigHub = await updateHash(init, hub.privateKey)
      init.sigUser = await updateHash(init, viewer.privateKey)
      await channelManager.startExit(viewer.address)
      await emptyChannelWithChallenge(init, viewer.address).should.be.rejectedWith('tokens must be conserved')
    })
  })



    describe('deployment', () => {
        it("verify hub address", async() => {
            const hubAddress = await channelManager.hub()
            assert.equal(hubAddress, accounts[0])
        })
        it("verify challenge period", async() => {
            const challengePeriod = await channelManager.challengePeriod()
            assert.equal(+challengePeriod, config.timeout)
        })
        it("verify approved token", async() => {
            const approvedToken = await channelManager.approvedToken()
            assert.equal(approvedToken, tokenAddress.address)
        })
    })

    describe('hubAuthorizedUpdate', () => {
        it("happy case", async() => {
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
        })

        it("FAIL : pending wei updates", async() => {
            init.pendingWeiUpdates = [0,0,0,1]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('VM Exception while processing transaction: revert')
        })

        it("FAIL: _verifyAuthorizedUpdate: timeout", async() => {
            init.timeout = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('the timeout must be zero or not have passed')
        })

        it("FAIL: _verifyAuthorizedUpdate: global txCount", async() => {
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            init.txCount = [0,1]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('global txCount must be higher than the current global txCount')
          })

        it("FAIL: _verifyAuthorizedUpdate: onchain txCount", async() => {
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)
            init.txCount = [2,0]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
        })

        it("FAIL: _verifyAuthorizedUpdate: wei conservation", async() => {
            init.weiBalances = [1,0]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('wei must be conserved')
        })

        it("FAIL: _verifyAuthorizedUpdate: token conservation", async() => {
            init.tokenBalances = [0,1]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('tokens must be conserved')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient reserve wei", async() => {
            init.pendingWeiUpdates = [1,0,0,0]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('insufficient reserve wei for deposits')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient reserve token", async() => {
            init.pendingTokenUpdates = [1,0,0,0]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('insufficient reserve tokens for deposits')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient wei", async() => {
            init.pendingWeiUpdates = [0,1,0,1]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('insufficient wei')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient token", async() => {
            init.pendingTokenUpdates = [0,1,0,1]
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('insufficient token')
        })

        it("FAIL: _verifySig: user is hub", async() => {
            init.user = hub.address
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('user can not be hub')
        })

        it("FAIL: _verifySig: user signature invalid", async() => {
            init.sigUser = await updateHash(init, performer.privateKey)
            await hubAuthorizedUpdate(init).should.be.rejectedWith('user signature invalid')
        })

        it("FAIL: _verifyAuthorizedUpdate: Channel not open", async() => {
            init.sigUser = await updateHash(init, viewer.privateKey)
            await channelManager.startExit(viewer.address) // channel.status = Status.ChannelDispute
            await hubAuthorizedUpdate(init).should.be.rejectedWith('channel must be open')
        })
    })

    describe('userAuthorizedUpdate', () => {
        it("happy case", async() => {
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer)
        })

        it("FAIL: msg.value not equal to deposit", async() => {
            init.txCount = [2,1]
            init.pendingWeiUpdates = [0,0,1,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('msg.value is not equal to pending user deposit')
        })

        it("FAIL: token deposit", async() => {
            init.txCount = [2,1]
            init.pendingTokenUpdates = [0,0,1,0] // should fail

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('VM Exception while processing transaction: revert')
        })

        it("FAIL: Wei transfer", async() => {
            init.txCount = [2,1]
            init.pendingWeiUpdates = [0,0,0,1] // should fail

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('VM Exception while processing transaction: revert')
        })

        it("FAIL: Token transfer", async() => {
            init.txCount = [2,1]
            init.pendingTokenUpdates = [0,0,0,1] // should fail

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('VM Exception while processing transaction: revert')
        })

        it("FAIL: _verifyAuthorizedUpdate: global txCount", async() => {
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer)
            init.txCount = [0,1]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('global txCount must be higher than the current global txCount')
        })

        it("FAIL: _verifyAuthorizedUpdate: onchain txCount", async() => {
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer)
            init.txCount = [2,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
        })

        it("FAIL: _verifyAuthorizedUpdate: timeout", async() => {
            init.txCount = [2,1]
            init.timeout = 1

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('the timeout must be zero or not have passed')
        })

        it("FAIL: _verifyAuthorizedUpdate: wei conservation", async() => {
            init.txCount = [2,1]
            init.weiBalances = [0, 1]

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('wei must be conserved')
        })

        it("FAIL: _verifyAuthorizedUpdate: token conservation", async() => {
            init.txCount = [2,1]
            init.tokenBalances = [0, 1]

            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('tokens must be conserved')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient reserve wei", async() => {
            init.txCount = [2,1]
            init.pendingWeiUpdates = [1,0,0,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('insufficient reserve wei for deposits')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient reserve token", async() => {
            init.txCount = [2,1]
            init.pendingTokenUpdates = [1,0,0,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('insufficient reserve tokens for deposits')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient wei", async() => {
            init.txCount = [2,1]
            init.pendingWeiUpdates = [0,1,0,1]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('insufficient wei')
        })

        it("FAIL: _verifyAuthorizedUpdate: insufficient wei", async() => {
            init.txCount = [2,1]
            init.pendingTokenUpdates = [0,1,0,1]
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('insufficient token')
        })

        it("FAIL: _verifySig: user is hub", async() => {
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer)
            init.txCount = [2,1]
            init.user = hub.address
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, hub).should.be.rejectedWith('user can not be hub')
        })

        it("FAIL: _verifySig: hub signature invalid", async() => {
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer)
            init.txCount = [2,1]
            init.user = hub.address
            init.sigHub = await updateHash(init, hub.privateKey)
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('hub signature invalid')
        })

        it("FAIL: _verifyAuthorizedUpdate: Channel not open", async() => {

            init.sigHub = await updateHash(init, hub.privateKey)
            await channelManager.startExit(viewer.address) // channel.status = Status.ChannelDispute
            await userAuthorizedUpdate(init, viewer).should.be.rejectedWith('channel must be open')
        })
    })

    describe('hubContractWithdraw', () => {
        it("happy case", async() => {
          await channelManager.hubContractWithdraw(0,0)
        })

        it("insufficient wei", async() => {
          await channelManager.hubContractWithdraw(1,0).should.be.rejectedWith('hubContractWithdraw: Contract wei funds not sufficient to withdraw')
        })

        it("insufficient token", async() => {
          await channelManager.hubContractWithdraw(0,1).should.be.rejectedWith('hubContractWithdraw: Contract token funds not sufficient to withdraw')
        })
    })

    describe('startExit', () => {
        it("happy case", async() => {
            await channelManager.startExit(hub.address)
        })
        it("FAIL : not user or hub", async() => {
            await channelManager.startExit(hub.address, {from: performer.address}).should.be.rejectedWith('exit initiator must be user or hub')
        })
        it("FAIL : channel not open", async() => {
            await channelManager.startExit(hub.address)
            await channelManager.startExit(hub.address).should.be.rejectedWith('channel must be open')
        })
    })

    describe('startExitWithUpdate', () => {
        it("happy case", async() => {
          init.user = viewer.address
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)
          await startExitWithUpdate(init, hub.address)
        })

        it("FAIL : not user or hub", async() => {
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)

          await startExitWithUpdate(init, performer.address).should.be.rejectedWith('exit initiator must be user or hub')
        })

        it("FAIL : timeout not zero", async() => {
          init.timeout = 1
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)

          await startExitWithUpdate(init, hub.address).should.be.rejectedWith('can\'t start exit with time-sensitive states')
        })

        it("FAIL: _verifySig: user is hub", async() => {
          init.user = hub.address
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)

          await startExitWithUpdate(init, hub.address).should.be.rejectedWith('user can not be hub')
        })

        it("FAIL: _verifyAuthorizedUpdate: global txCount", async() => {
          init.txCount = [0,1]
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)

          await startExitWithUpdate(init, hub.address).should.be.rejectedWith('global txCount must be higher than the current global txCount')
        })

        it("FAIL: _verifyAuthorizedUpdate: onchain txCount", async() => {
            const weiDeposit = 1
            init.sigUser = await updateHash(init, viewer.privateKey)
            await hubAuthorizedUpdate(init)

            init.txCount = [2,2]
            init.pendingWeiUpdates = [0,0,weiDeposit,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await userAuthorizedUpdate(init, viewer, weiDeposit)

            init.txCount = [3,1]
            init.pendingWeiUpdates = [0,0,weiDeposit,0]
            init.sigHub = await updateHash(init, hub.privateKey)
            init.sigUser = await updateHash(init, viewer.privateKey)
            await startExitWithUpdate(init, hub.address).should.be.rejectedWith('onchain txCount must be higher or equal to the current onchain txCount')
        })

        it("FAIL: _verifyAuthorizedUpdate: wei conservation", async() => {
          init.txCount = [2,1]
          init.weiBalances = [0, 1]
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)
          await startExitWithUpdate(init, viewer.address).should.be.rejectedWith('wei must be conserved')
        })

        it("FAIL: _verifyAuthorizedUpdate: token conservation", async() => {
          init.txCount = [2,1]
          init.tokenBalances = [0, 1]
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)
          await startExitWithUpdate(init, hub.address).should.be.rejectedWith('tokens must be conserved')
        })


        it("FAIL: channel not open", async() => {
          init.sigHub = await updateHash(init, hub.privateKey)
          init.sigUser = await updateHash(init, viewer.privateKey)
          await channelManager.startExit(viewer.address) // channel.status = Status.ChannelDispute
          await startExitWithUpdate(init, hub.address).should.be.rejectedWith('channel must be open')
        })
    })

    describe('emptyChannel', () => {
        it("happy case", async() => {
            await channelManager.startExit(hub.address)
            await moveForwardSecs(config.timeout + 1)
            await channelManager.emptyChannel(hub.address)
          })

        it("FAIL : channel not in dispute", async() => {
          await channelManager.emptyChannel(hub.address).should.be.rejectedWith('channel must be in dispute')
        })

        it("FAIL : channel closing time not passed", async() => {
          await channelManager.startExit(hub.address)
          await channelManager.emptyChannel(hub.address).should.be.rejectedWith('channel closing time must have passed')
        })
    })
})