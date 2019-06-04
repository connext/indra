const BN = require('bn.js');
const should = require('chai');
const Connext = require('connext');
const ConnextTester = require('connext/dist/testing');
const HttpProvider = require('ethjs-provider-http');
const EthRPC = require('ethjs-rpc');

const data = require('../ops/data.json');

const CM = artifacts.require('./ChannelManager.sol');
const HST = artifacts.require('./HumanStandardToken.sol');

/* Setup Connext Client Stuff */
const convert = Connext.convert

const {
  getChannelState,
  getThreadState,
  getDepositArgs,
  getWithdrawalArgs,
  getExchangeArgs,
  getPaymentArgs,
  getPendingArgs
} = ConnextTester

const toBN = (num) => new BN(num.toString())

should
  .use(require("chai-as-promised"))
  .use(require("bn-chai")(BN))
  .should();

const privKeys = data.testPrivateKeys
const ethRPC = new EthRPC(new HttpProvider("http://localhost:8545"));
const emptyRootHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

const emptyAddress = "0x0000000000000000000000000000000000000000";
const someAddress = "0xabcd000000000000000000000000000000000000";

const secondsFromNow = seconds => seconds + Math.floor(new Date().getTime() / 1000);
const minutesFromNow = minutes => secondsFromNow(minutes * 60);

const channelStatus = {
  Open: 0,
  ChannelDispute: 1,
  ThreadDispute: 2
};

////////////////////////////////////////
// External Helper Functions
////////////////////////////////////////

async function snapshot() {
  return new Promise((accept, reject) => {
    ethRPC.sendAsync({ method: `evm_snapshot` }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        accept(result);
      }
    });
  });
}

async function restore(snapshotId) {
  return new Promise((accept, reject) => {
    ethRPC.sendAsync({ method: `evm_revert`, params: [snapshotId] }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        accept(result);
      }
    });
  });
}

async function moveForwardSecs(secs) {
  await ethRPC.sendAsync(
    {
      jsonrpc: "2.0",
      method: `evm_increaseTime`,
      params: [secs],
      id: 0
    },
    err => {
      `error increasing time`;
    }
  );
  // not sure how/why, but having this idle period makes this work
  const start = Date.now();
  while (Date.now() < start + 300) {}
  await ethRPC.sendAsync({ method: `evm_mine` }, err => {});
  while (Date.now() < start + 300) {}
  return true;
}

async function getBlockTimeByTxHash(txHash) {
  const blockNumber = (await web3.eth.getTransaction(txHash)).blockNumber;
  return +(await web3.eth.getBlock(blockNumber)).timestamp;
}

function getEventParams(tx, event) {
  if (tx.logs.length > 0) {
    for (let idx = 0; idx < tx.logs.length; idx++) {
      if (tx.logs[idx].event == event) {
        return tx.logs[idx].args;
      }
    }
  }
  return false;
}

function zeroBalances(state) {
  return {
    ...state,
    balanceWeiHub: 0,
    balanceWeiUser: 0,
    balanceTokenHub: 0,
    balanceTokenUser: 0
  };
}

// takes a Connext channel state and converts it to the contract format
function normalize(state) {
  state = convert.ChannelState("bn", state);
  return {
    ...state,
    user: state.user,
    recipient: state.recipient,
    weiBalances: [state.balanceWeiHub, state.balanceWeiUser],
    tokenBalances: [state.balanceTokenHub, state.balanceTokenUser],
    pendingWeiUpdates: [state.pendingDepositWeiHub, state.pendingWithdrawalWeiHub, state.pendingDepositWeiUser, state.pendingWithdrawalWeiUser],
    pendingTokenUpdates: [
      state.pendingDepositTokenHub,
      state.pendingWithdrawalTokenHub,
      state.pendingDepositTokenUser,
      state.pendingWithdrawalTokenUser
    ],
    txCount: [state.txCountGlobal, state.txCountChain],
    threadRoot: state.threadRoot,
    threadCount: state.threadCount,
    timeout: state.timeout
  };
}

async function getSig(state, account) {
  const hash = clientUtils.createChannelStateHash(state);
  const signature = await web3.eth.sign(hash, account.address);
  return signature;
}

async function getThreadSig(threadState, account) {
  const hash = clientUtils.createThreadStateHash(threadState);
  const sig = await web3.eth.sign(hash, account.address);
  return sig;
}

// Generates an array of incorrect sigs to test each element of state for _verifySig
async function generateIncorrectSigs(state, signer) {
  let sigArray = new Array();
  let i = 0;

  //methodology: save element to temp, change element and sign, restore element from temp
  for (var element in state) {
    let temp = state[element];
    //The below if/else gates ensure that state[element] is always changed
    //if the element is not already it's initial value, reinitialize
    if (state[element] != getChannelState("empty")[element]) state[element] = getChannelState("empty")[element];
    //else (i.e. element == initial value) increment that value
    else state[element] = getChannelState("empty")[element] + 1;
    //edge case: if element is threadRoot, set to 0x01
    if (element == "threadRoot") state[element] = "0x0100000000000000000000000000000000000000000000000000000000000000";

    sigArray[i] = await getSig(state, signer);
    state[element] = temp;
    i++;
  }

  //for final sig, signer needs to be incorrect
  //if the expected signer is viewer or performer, then have hub sign
  if (signer != hub) sigArray[i] = await getSig(state, hub);
  //if the expected signer is hub, then have viewer sign
  else sigArray[i] = await getSig(state, viewer);

  return sigArray;
}

// Generates an array of incorrect sigs to test each element of state for _verifySig
async function generateIncorrectThreadSigs(state, signer) {
  let sigArray = new Array();
  let i = 0;

  //methodology: save element to temp, change element and sign, restore element from temp
  for (var element in state) {

    let temp = state[element];
    //The below if/else gates ensure that state[element] is always changed
    //if the element is not already it's initial value, reinitialize
    if (state[element] != getThreadState("empty")[element]) state[element] = getThreadState("empty")[element];
    //else (i.e. element == initial value) increment that value
    else state[element] = getThreadState("empty")[element] + 1;
    //edge case: this one will be handled by changing the signer below
    if (element == 'sigA') continue

    sigArray[i] = await getThreadSig(state, signer);

    state[element] = temp;
    i++;
  }

  //for final sig, signer needs to be incorrect
  //if the expected signer is viewer or performer, then have hub sign
  if (signer != hub) sigArray[i] = await getThreadSig(state, hub);
  //if the expected signer is hub, then have viewer sign
  else sigArray[i] = await getThreadSig(state, viewer);

  return sigArray;
}

// channel update fn wrappers
async function userAuthorizedUpdate(state, account, wei = 0) {
  state = normalize(state);
  return await cm.userAuthorizedUpdate(
    state.recipient,
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    { from: account.address, value: wei }
  );
}

async function hubAuthorizedUpdate(state, account, wei = 0) {
  state = normalize(state);
  return await cm.hubAuthorizedUpdate(
    state.user,
    state.recipient,
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigUser,
    { from: account.address, value: wei }
  );
}

// channel dispute fn wrappers
async function startExit(state, account, wei = 0) {
  return await cm.startExit(state.user, { from: account.address, value: wei });
}

async function startExitWithUpdate(state, account, wei = 0) {
  state = normalize(state);
  return await cm.startExitWithUpdate(
    [state.user, state.recipient],
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    state.sigUser,
    { from: account.address, value: wei }
  );
}

async function emptyChannelWithChallenge(state, account, wei = 0) {
  state = normalize(state);
  return await cm.emptyChannelWithChallenge(
    [state.user, state.recipient],
    state.weiBalances,
    state.tokenBalances,
    state.pendingWeiUpdates,
    state.pendingTokenUpdates,
    state.txCount,
    state.threadRoot,
    state.threadCount,
    state.timeout,
    state.sigHub,
    state.sigUser,
    { from: account.address, value: wei }
  );
}

async function emptyChannel(state, account, wei = 0) {
  return await cm.emptyChannel(state.user, { from: account.address, value: wei });
}

// thread dispute fn wrappers
async function startExitThread(state, threadState, proof, sig, account) {
  let normalized = normalize(state);
  return await cm.startExitThread(
    normalized.user,
    threadState.sender,
    threadState.receiver,
    threadState.threadId,
    [threadState.balanceWeiSender, 0],
    [threadState.balanceTokenSender, 0],
    proof,
    sig,
    { from: account.address }
  );
}

async function startExitThreadWithUpdate(state, threadStateInitial, threadStateUpdated, proof, sigInital, sigUpdated, account) {
  let normalized = normalize(state);
  return await cm.startExitThreadWithUpdate(
    normalized.user,
    [threadStateInitial.sender, threadStateInitial.receiver],
    threadStateInitial.threadId,
    [threadStateInitial.balanceWeiSender, 0],
    [threadStateInitial.balanceTokenSender, 0],
    proof,
    sigInital,
    [threadStateUpdated.balanceWeiSender, threadStateUpdated.balanceWeiReceiver],
    [threadStateUpdated.balanceTokenSender, threadStateUpdated.balanceTokenReceiver],
    threadStateUpdated.txCount,
    sigUpdated,
    { from: account.address }
  );
}

async function emptyThread(state, threadState, proof, sig, account) {
  let normalized = normalize(state);
  /*
  console.log(`emptying thread with params:
    user: ${normalized.user},
    sender: ${threadState.sender},
    receiver: ${threadState.receiver},
    threadId: ${threadState.threadId},
    balanceWei: [${[threadState.balanceWeiSender, 0]}],
    balanceToken: [${[threadState.balanceTokenSender, 0]}],
    proof: ${proof},
    sig: ${sig},
    ${JSON.stringify({ from: account.address })}
  `);
  */
  return await cm.emptyThread(
    normalized.user,
    threadState.sender,
    threadState.receiver,
    threadState.threadId,
    [threadState.balanceWeiSender, 0],
    [threadState.balanceTokenSender, 0],
    proof,
    sig,
    { from: account.address }
  );
}

async function challengeThread(threadState, sig, account) {
  return await cm.challengeThread(
    threadState.sender,
    threadState.receiver,
    threadState.threadId,
    [threadState.balanceWeiSender, threadState.balanceWeiReceiver],
    [threadState.balanceTokenSender, threadState.balanceTokenReceiver],
    threadState.txCount,
    sig,
    { from: account.address }
  );
}

async function submitUserAuthorized(userAccount, hubAccount, wei = 0, ...overrides) {
  let state = getChannelState(
    "empty",
    {
      user: userAccount.address,
      recipient: userAccount.address,
      balanceToken: [3, 0],
      balanceWei: [0, 2],
      pendingDepositWei: [0, wei],
      pendingDepositToken: [7, 0],
      txCount: [1, 1]
    },
    overrides
  );
  state.sigHub = await getSig(state, hubAccount);
  return await userAuthorizedUpdate(state, userAccount, wei);
}

async function submitHubAuthorized(userAccount, hubAccount, wei = 0, ...overrides) {
  let state = getChannelState(
    "empty",
    {
      user: userAccount.address,
      recipient: userAccount.address,
      balanceToken: [3, 0],
      balanceWei: [0, 2],
      pendingDepositWei: [0, wei],
      pendingDepositToken: [7, 0],
      txCount: [1, 1]
    },
    overrides
  );
  state.sigUser = await getSig(state, userAccount);
  return await hubAuthorizedUpdate(state, hubAccount, wei);
}

////////////////////////////////////////
// Internal Helper Functions
////////////////////////////////////////

let cm, token, hub, performer, viewer, state, validator, initHubReserveWei, initHubReserveToken, challengePeriod, channelStateReceiver, clientUtils, sg;

contract("ChannelManager", accounts => {
  let snapshotId;

  // asserts that the onchain-channel state matches provided offchain state

  const verifyChannelBalances = async (account, state) => {
    const stateBN = convert.ChannelState("bn", state); // This is an ethers BN
    const channelBalances = await cm.getChannelBalances(account.address); // This is a BigNumber

    // Wei balances are equal
    assert(channelBalances.weiHub.eq(toBN(stateBN.balanceWeiHub)));
    assert(channelBalances.weiUser.eq(toBN(stateBN.balanceWeiUser)));
    assert(channelBalances.weiTotal.eq(toBN(stateBN.balanceWeiHub.add(stateBN.balanceWeiUser))));

    // Token balances are equal
    assert(channelBalances.tokenHub.eq(toBN(stateBN.balanceTokenHub)));
    assert(channelBalances.tokenUser.eq(toBN(stateBN.balanceTokenUser)));
    assert(channelBalances.tokenTotal.eq(toBN(stateBN.balanceTokenHub.add(stateBN.balanceTokenUser))));
  };

  // status, exitInitiator, and channelClosingTime must be explicitely
  // set on the state object or are assumed to be 0, emptyAddress, and 0
  const verifyChannelDetails = async (account, state) => {
    const stateBN = convert.ChannelState("bn", state);
    const channelDetails = await cm.getChannelDetails(account.address);
    // Tx counts are equal to the original update (state increments)
    assert(channelDetails.txCountGlobal.eq(toBN(stateBN.txCountGlobal)));
    assert(channelDetails.txCountChain.eq(toBN(stateBN.txCountChain)));

    // Thread states are equal
    assert.equal(channelDetails.threadRoot, state.threadRoot);
    assert.equal(channelDetails.threadCount, state.threadCount);

    // check exit params
    assert(channelDetails.channelClosingTime.eq(toBN(state.channelClosingTime ? state.channelClosingTime : 0)));
    assert.equal(channelDetails.exitInitiator.toLowerCase(), (state.exitInitiator || emptyAddress).toLowerCase());
    assert.equal(channelDetails.status, state.status ? state.status : 0);
  };

  const verifyAuthorizedUpdate = async (account, update, tx, isHub) => {
    const confirmed = await validator.generateConfirmPending(update, {
      transactionHash: tx.tx
    });

    // verify channel balances match the confirmed offchain values
    await verifyChannelBalances(account, confirmed);

    // use update for verifying channel details b/c txCounts will match
    await verifyChannelDetails(account, update);

    const updateBN = convert.ChannelState("bn", update);

    const event = getEventParams(tx, "DidUpdateChannel");
    assert.equal(event.user.toLowerCase(), account.address.toLowerCase());
    assert.equal(event.senderIdx, isHub ? 0 : 1);

    assert(event.weiBalances[0].eq(toBN(updateBN.balanceWeiHub)));
    assert(event.weiBalances[1].eq(toBN(updateBN.balanceWeiUser)));
    assert(event.tokenBalances[0].eq(toBN(updateBN.balanceTokenHub)));
    assert(event.tokenBalances[1].eq(toBN(updateBN.balanceTokenUser)));
    assert(event.pendingWeiUpdates[0].eq(toBN(updateBN.pendingDepositWeiHub)));
    assert(event.pendingWeiUpdates[1].eq(toBN(updateBN.pendingWithdrawalWeiHub)));
    assert(event.pendingWeiUpdates[2].eq(toBN(updateBN.pendingDepositWeiUser)));
    assert(event.pendingWeiUpdates[3].eq(toBN(updateBN.pendingWithdrawalWeiUser)));
    assert(event.pendingTokenUpdates[0].eq(toBN(updateBN.pendingDepositTokenHub)));
    assert(event.pendingTokenUpdates[1].eq(toBN(updateBN.pendingWithdrawalTokenHub)));
    assert(event.pendingTokenUpdates[2].eq(toBN(updateBN.pendingDepositTokenUser)));
    assert(event.pendingTokenUpdates[3].eq(toBN(updateBN.pendingWithdrawalTokenUser)));
    assert.equal(+event.txCount[0], update.txCountGlobal);
    assert.equal(+event.txCount[1], update.txCountChain);
    assert.equal(event.threadRoot, emptyRootHash);
    assert.equal(event.threadCount, 0);
  };

  const verifyUserAuthorizedUpdate = async (account, update, tx) => {
    await verifyAuthorizedUpdate(account, update, tx, false);
  };

  const verifyHubAuthorizedUpdate = async (account, update, tx) => {
    await verifyAuthorizedUpdate(account, update, tx, true);
  };

  // isHub refers to the initiator
  const verifyStartExit = async (account, update, tx, isHub) => {
    const blockTime = await getBlockTimeByTxHash(tx.tx);

    // explicitely set so they can be checked by verifyChannelDetails
    update.exitInitiator = (isHub ? hub.address : account.address).toLowerCase();
    update.status = 1;
    update.channelClosingTime = blockTime + challengePeriod;

    await verifyChannelBalances(account, update);
    await verifyChannelDetails(account, update);

    const updateBN = convert.ChannelState("bn", update);

    const event = getEventParams(tx, "DidStartExitChannel");
    assert.equal(event.user.toLowerCase(), account.address.toLowerCase());
    assert.equal(event.senderIdx, isHub ? 0 : 1);

    assert(event.weiBalances[0].eq(toBN(updateBN.balanceWeiHub)));
    assert(event.weiBalances[1].eq(toBN(updateBN.balanceWeiUser)));
    assert(event.tokenBalances[0].eq(toBN(updateBN.balanceTokenHub)));
    assert(event.tokenBalances[1].eq(toBN(updateBN.balanceTokenUser)));
    assert.equal(+event.txCount[0], update.txCountGlobal);
    assert.equal(+event.txCount[1], update.txCountChain);
    assert.equal(event.threadRoot, emptyRootHash);
    assert.equal(event.threadCount, 0);
  };

  // pass initHubReserveWei/Token on state obj for convenience
  const verifyEmptyChannel = async (account, state, tx, isHub, testUserWei = true) => {
    await verifyChannelBalances(account, zeroBalances(state));

    // status, channelClosingTime, and exitInitiator are default values
    // which will properly test that they have been reset
    await verifyChannelDetails(account, state);

    // conditional to make skipping easy for when user initiates the
    // emptyChannel/WithChallenge tx
    if (testUserWei) {
      // wei is transfered to user
      const userWeiBalance = await web3.eth.getBalance(account.address);
      assert.equal(+userWeiBalance, +account.initWeiBalance + state.userWeiTransfer);
    }

    // token is transfered to user
    const userTokenBalance = await token.balanceOf(account.address);
    assert(userTokenBalance.eq(toBN(account.initTokenBalance.add(new BN(state.userTokenTransfer)))));

    const totalChannelWei = await cm.totalChannelWei.call();
    assert.equal(+totalChannelWei, 0);

    const hubReserveWei = await cm.getHubReserveWei();
    assert(hubReserveWei.eq(toBN(state.initHubReserveWei - state.userWeiTransfer)));

    const totalChannelToken = await cm.totalChannelToken.call();
    assert.equal(+totalChannelToken, 0);

    const hubReserveToken = await cm.getHubReserveTokens();
    assert(hubReserveToken.eq(toBN(state.initHubReserveToken - state.userTokenTransfer)));

    const event = getEventParams(tx, "DidEmptyChannel");
    assert.equal(event.user.toLowerCase(), account.address.toLowerCase());
    assert.equal(event.senderIdx, isHub ? 0 : 1);

    assert(event.weiBalances[0].eq(toBN(0)));
    assert(event.weiBalances[1].eq(toBN(0)));
    assert(event.tokenBalances[0].eq(toBN(0)));
    assert(event.tokenBalances[1].eq(toBN(0)));
    assert.equal(+event.txCount[0], state.txCountGlobal);
    assert.equal(+event.txCount[1], state.txCountChain);
    assert.equal(event.threadRoot, emptyRootHash);
    assert.equal(event.threadCount, 0);
  };

  /**
   * Fast forward channel to after EmptyChannel is called.
   * To initiate thread dispute, insert state with thread count and thread root.
   */
  async function fastForwardToEmptiedChannel(insertedState, threadState, user) {
    const deposit = getDepositArgs("empty", {
      ...insertedState,
      depositWeiUser: 20,
      depositTokenUser: 21,
      depositWeiHub: 22,
      depositTokenHub: 23,
      timeout: minutesFromNow(5)
    });
    const update = validator.generateProposePendingDeposit(insertedState, deposit);
    update.sigUser = await getSig(update, user);

    let tx = await hubAuthorizedUpdate(update, hub, 0);
    let channelBalances = await cm.getChannelBalances(viewer.address);

    confirmed = await validator.generateConfirmPending(update, {
      transactionHash: tx.tx
    });
    confirmed.sigUser = await getSig(confirmed, user);
    confirmed.sigHub = await getSig(confirmed, hub);

    // initial state is the confirmed values with txCountGlobal rolled back
    insertedState = {
      ...confirmed,
      txCountGlobal: confirmed.txCountGlobal - 1
    };

    // generate state for thread open
    const threadOpen = validator.generateOpenThread(insertedState, [], threadState);
    threadOpen.sigUser = await getSig(threadOpen, user);
    threadOpen.sigHub = await getSig(threadOpen, hub);

    await startExitWithUpdate(threadOpen, user, 0);

    tx = await emptyChannel(threadOpen, hub, 0);

    return threadOpen;
  }

  ////////////////////////////////////////
  // Test Env Setup
  ////////////////////////////////////////

  before("deploy contracts", async () => {
    cm = await CM.deployed();
    token = await HST.deployed();

    hub = {
      address: accounts[0].toLowerCase(),
      pk: privKeys[0]
    };
    performer = {
      address: accounts[1].toLowerCase(),
      pk: privKeys[1]
    };
    viewer = {
      address: accounts[2].toLowerCase(),
      pk: privKeys[2]
    };

    validator = new Connext.Validator(hub.address, web3.eth, cm.abi);

    clientUtils = new Connext.Utils(hub.address)

    sg = new Connext.StateGenerator(hub.address);

    challengePeriod = +(await cm.challengePeriod.call()).toString();
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
    // TODO: rename this
    state = getChannelState("empty", {
      contractAddress: cm.address.toLowerCase(),
      user: viewer.address,
      recipient: viewer.address,
      txCountGlobal: 0,
      txCountChain: 0
    });

    channelStateReceiver = getChannelState("empty", {
      contractAddress: cm.address.toLowerCase(),
      user: performer.address,
      recipient: performer.address,
      txCountGlobal: 0,
      txCountChain: 0
    });
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  ////////////////////////////////////////
  // Tests
  ////////////////////////////////////////

  describe("contract deployment", () => {
    it("verify init parameters", async () => {
      const hubAddress = await cm.hub.call();
      assert.equal(hubAddress.toLowerCase(), hub.address);
      // challengePeriod set in *before* block
      assert.equal(+data.channelManager.challengePeriod, challengePeriod);
      const approvedToken = await cm.approvedToken.call();
      assert.equal(token.address, approvedToken);
    });
  });

  describe("reserve management", () => {
    it("accept ETH - getHubReserveWei", async () => {
      const weiAmount = 1;
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount });
      const reserveWei = await cm.getHubReserveWei();
      assert.equal(reserveWei, weiAmount);
    });

    it("accept tokens - getHubReserveTokenss", async () => {
      const tokenAmount = 1;
      await token.transfer(cm.address, tokenAmount, { from: hub.address });
      const reserveToken = await cm.getHubReserveTokens();
      assert.equal(reserveToken, tokenAmount);
    });

    describe("hubContractWithdraw", () => {
      it("happy case", async () => {
        const weiAmount = 1;
        const tokenAmount = 2;
        const hubInitialToken = await token.balanceOf(hub.address);
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount });
        await token.transfer(cm.address, tokenAmount, { from: hub.address });
        await cm.hubContractWithdraw(weiAmount, tokenAmount);
        const reserveToken = await cm.getHubReserveTokens();
        const reserveWei = await cm.getHubReserveWei();
        assert.equal(reserveWei, 0);
        assert.equal(reserveToken, 0);

        const hubFinalToken = await token.balanceOf(hub.address);
        assert(hubFinalToken.eq(toBN(hubInitialToken)));
      });

      it("fails with insufficient ETH", async () => {
        const weiAmount = 1;
        const tokenAmount = 1;
        const weiToWithdraw = weiAmount + 1;
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount });
        await token.transfer(cm.address, tokenAmount, { from: hub.address });
        await cm
          .hubContractWithdraw(weiToWithdraw, tokenAmount)
          .should.be.rejectedWith(/hubContractWithdraw: Contract wei funds not sufficient to withdraw/);
      });

      it("fails with insufficient token", async () => {
        const weiAmount = 1;
        const tokenAmount = 1;
        const tokenToWithdraw = tokenAmount + 1;
        await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: weiAmount });
        await token.transfer(cm.address, tokenAmount, { from: hub.address });
        await cm
          .hubContractWithdraw(weiAmount, tokenToWithdraw)
          .should.be.rejectedWith(/hubContractWithdraw: Contract token funds not sufficient to withdraw/);
      });
    });
  });

  describe("userAuthorizedUpdate - deposit", () => {
    beforeEach(async () => {
      const userTokenBalance = 1000;
      await token.transfer(viewer.address, userTokenBalance, { from: hub.address });
      await token.approve(cm.address, userTokenBalance, { from: viewer.address });

      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });
      initHubReserveWei = await cm.getHubReserveWei();
      initHubReserveToken = await cm.getHubReserveTokens();
    });

    describe("happy case", () => {
      it("user deposit wei", async () => {
        const timeout = minutesFromNow(5);

        // Applying and generating args
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);

        update.sigHub = await getSig(update, hub);
        const tx = await userAuthorizedUpdate(update, viewer, 10);

        await verifyUserAuthorizedUpdate(viewer, update, tx);

        const totalChannelWei = await cm.totalChannelWei.call();

        assert.equal(+totalChannelWei, 10);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei)));
      });

      it("user deposit token", async () => {
        const timeout = minutesFromNow(5);

        // Applying and generating args
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);

        update.sigHub = await getSig(update, hub);
        const tx = await userAuthorizedUpdate(update, viewer, 0);

        await verifyUserAuthorizedUpdate(viewer, update, tx);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 0);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei)));
      });

      // userAuthorizedDeposit - real world sim
      //  1. User deposit ETH + hub deposit BOOTY
      //  2. Offchain exchange ETH - BOOTY
      //  3. Tip all the BOOTY
      //  4. User deposit ETH + hub withdrawal ETH
      it("viewer simulation", async () => {
        //  1. User deposit ETH + hub deposit BOOTY
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 100,
          depositTokenHub: 69,
          timeout: minutesFromNow(5)
        });

        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);
        const tx = await userAuthorizedUpdate(update, viewer, 100);
        await verifyUserAuthorizedUpdate(viewer, update, tx);

        // 1.5 confirm the deposit
        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });
        confirmed.sigHub = await getSig(confirmed, hub);

        const exchange = getExchangeArgs("empty", {
          ...confirmed,
          seller: "hub",
          tokensToSell: 69,
          exchangeRate: "1"
        });

        //  2. Offchain exchange ETH - BOOTY
        const update2 = validator.generateExchange(confirmed, exchange);
        update2.sigHub = await getSig(update, hub);

        //  3. Tip all of the BOOTY
        const payment = getPaymentArgs("empty", {
          ...update2,
          amountWei: 0,
          amountToken: 69,
          recipient: "hub"
        });

        const update3 = validator.generateChannelPayment(update2, payment);

        // 4. user tops up wei while hub withdraws wei
        // Note - this isn't supported through proposePendingDeposit
        // Using proposePendingInstead
        const pending = getPendingArgs("empty", {
          ...update3,
          depositWeiUser: 50,
          withdrawalWeiHub: 69
        });
        const update4 = sg.proposePending(update3, convert.ProposePending("bn", pending));
        update4.sigHub = await getSig(update4, hub);
        const tx2 = await userAuthorizedUpdate(update4, viewer, 50);
        await verifyUserAuthorizedUpdate(viewer, update4, tx2, false);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 81); // 100 - 69 + 50

        const hubReserveWei = await cm.getHubReserveWei();
        assert.equal(hubReserveWei, +initHubReserveWei + 69);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 69);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert.equal(hubReserveToken, +initHubReserveToken - 69);
      });
    });

    describe("failing requires", () => {
      it("fails when sent wei does not match pending wei deposit", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);

        // sending 20 wei
        await userAuthorizedUpdate(update, viewer, 20).should.be.rejectedWith("msg.value is not equal to pending user deposit.");
      });

      it('userAuthorizedUpdate - fails when channel status is not "Open"', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout: minutesFromNow(5)
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);

        await startExit(update, hub, 0);
        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("channel must be open.");
      });

      it("fails when timeout expired", async () => {
        const timeout = 1;
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);
        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("the timeout must be zero or not have passed.");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 1 - txCount[0] = channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 0
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);
        await userAuthorizedUpdate(update, viewer, 10);

        // Then submit another deposit at the same txCountGlobal = 0
        // (will be the same because we're using the same initital state to gen)
        const newUpdate = validator.generateProposePendingDeposit(state, deposit);
        newUpdate.sigHub = await getSig(newUpdate, hub);

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith("global txCount must be higher than the current global txCount");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 2 - txCount[0] < channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 1
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.txCountGlobal = 1;
        update.sigHub = await getSig(update, hub);
        await userAuthorizedUpdate(update, viewer, 10);

        // Then submit another deposit at the same txCountGlobal = 0
        const newUpdate = validator.generateProposePendingDeposit(state, deposit);
        newUpdate.txCountGlobal = 0;
        newUpdate.sigHub = await getSig(newUpdate, hub);

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith("global txCount must be higher than the current global txCount");
      });

      it("fails when txCount[1] < channel.txCount[1]", async () => {
        //First submit a deposit at default txCountChain
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        //txCountGlobal = 1
        update.txCountChain = 1;
        update.sigHub = await getSig(update, hub);
        await userAuthorizedUpdate(update, viewer, 10);

        // Then submit another deposit at the same txCountChain
        const newUpdate = validator.generateProposePendingDeposit(state, deposit);
        newUpdate.txCountGlobal = 2; // have to increment global count here to pass above test
        newUpdate.txCountChain = 0;
        newUpdate.sigHub = await getSig(newUpdate, hub);

        await userAuthorizedUpdate(newUpdate, viewer, 10).should.be.rejectedWith(
          "onchain txCount must be higher or equal to the current onchain txCount"
        );
      });

      it("fails when wei is not conserved", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.balanceWeiUser = 20;
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("wei must be conserved");
      });

      it("fails when token are not conserved", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.balanceTokenUser = 20;
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("tokens must be conserved");
      });

      it("fails when insufficient reserve wei", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 1001,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("insufficient reserve wei for deposits");
      });

      it("fails when insufficient reserve token", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 1001,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("insufficient reserve tokens for deposits");
      });

      it("fails when current total channel wei + both deposits is less than final balances + withdrawals", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.pendingWithdrawalWeiUser = 20; //also tested here with hub withdrawal
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("insufficient wei");
      });

      it("fails when current total channel token + both deposits is less than final balances + withdrawals", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.pendingWithdrawalTokenUser = 20; //also tested here with hub withdrawal
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("insufficient token");
      });

      it("fails if sender is hub", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigHub = await getSig(update, hub);

        await userAuthorizedUpdate(update, hub, 10).should.be.rejectedWith("user can not be hub");
      });

      it("fails when hub signature is incorrect (long test)", async () => {
        const timeout = minutesFromNow(5);
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10,
          timeout
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        const sigArrayHub = await generateIncorrectSigs(update, hub);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayHub.length; i++) {
          update.sigHub = sigArrayHub[i];
          // console.log("Now testing signature: " + update.sigHub)
          await userAuthorizedUpdate(update, viewer, 10).should.be.rejectedWith("hub signature invalid");
        }
      });
    });
  });

  describe("hubAuthorizedUpdate", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });
      initHubReserveWei = await cm.getHubReserveWei();
      initHubReserveToken = await cm.getHubReserveTokens();
    });

    describe("happy case", () => {
      it("hub deposit wei", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 10);

        const hubReserveWei = await cm.getHubReserveWei();
        assert.equal(hubReserveWei, initHubReserveWei - 10);
      });

      it("hub deposit token", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 10);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert.equal(hubReserveToken, initHubReserveToken - 10);
      });

      it("hub deposit wei for user", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 10);

        const hubReserveWei = await cm.getHubReserveWei();
        assert.equal(hubReserveWei, initHubReserveWei - 10);
      });

      it("hub deposit token for user", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 10);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert.equal(hubReserveToken, initHubReserveToken - 10);
      });

      it("hub deposit wei/token for itself and user", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 5,
          depositTokenHub: 7,
          depositWeiUser: 8,
          depositTokenUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 17); // 7 + 10

        const hubReserveToken = await cm.getHubReserveTokens();
        assert.equal(hubReserveToken, initHubReserveToken - 17);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 13); // 5 + 8

        const hubReserveWei = await cm.getHubReserveWei();
        assert.equal(hubReserveWei, initHubReserveWei - 13);
      });

      it("user withdrawal wei direct from hub deposit", async () => {
        const withdrawal = getWithdrawalArgs("empty", {
          ...state,
          additionalWeiHubToUser: 5
        });
        const update = sg.proposePendingWithdrawal(convert.ChannelState("bn", state), convert.Withdrawal("bn", withdrawal));

        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 0);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken)));

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 0);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 5)));
      });

      it("user withdrawal token direct from hub deposit", async () => {
        const withdrawal = getWithdrawalArgs("empty", {
          ...state,
          additionalTokenHubToUser: 5
        });
        const update = sg.proposePendingWithdrawal(convert.ChannelState("bn", state), convert.Withdrawal("bn", withdrawal));

        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 0);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 5)));

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 0);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei)));
      });

      it("hub deposit wei for user, user pays hub, hub checkpoints", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });
        confirmed.sigUser = await getSig(confirmed, viewer);
        confirmed.sigHub = await getSig(confirmed, hub);

        // apply payment and send to chain
        const payment = getPaymentArgs("empty", {
          ...confirmed,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update2 = validator.generateChannelPayment(confirmed, payment);
        update2.sigUser = await getSig(update2, viewer);
        const tx2 = await hubAuthorizedUpdate(update2, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update2, tx2, true);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert(totalChannelWei.eq(toBN(10)));

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 10)));
      });

      it("hub deposit wei for user, user pays hub, they both withdraw", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });
        confirmed.sigUser = getSig(confirmed, viewer);
        confirmed.sigHub = getSig(confirmed, hub);

        // apply payment but don't send to chain
        const payment = getPaymentArgs("empty", {
          ...confirmed,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update2 = validator.generateChannelPayment(confirmed, payment);
        update2.sigUser = getSig(update2, viewer);
        update2.sigHub = getSig(update2, hub);

        // withdraw all wei
        const withdrawal = getWithdrawalArgs("empty", {
          ...update2,
          targetWeiUser: 0,
          targetWeiHub: 0
        });
        const update3 = validator.generateProposePendingWithdrawal(update2, convert.Withdrawal("bn", withdrawal));
        update3.sigUser = await getSig(update3, viewer);
        const tx2 = await hubAuthorizedUpdate(update3, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update3, tx2, true);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert(totalChannelWei.eq(toBN(0)));

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 7)));
      });

      it("hub deposit token for user, user pays hub, they both withdraw", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });
        confirmed.sigUser = await getSig(confirmed, viewer);
        confirmed.sigHub = await getSig(confirmed, hub);

        // apply payment but don't send to chain
        const payment = getPaymentArgs("empty", {
          ...confirmed,
          amountWei: 0,
          amountToken: 3,
          recipient: "hub"
        });
        const update2 = validator.generateChannelPayment(confirmed, payment);
        update2.sigUser = await getSig(update2, viewer);
        update2.sigHub = await getSig(update2, hub);

        // withdraw all token
        const withdrawal = getWithdrawalArgs("empty", {
          ...update2,
          targetTokenUser: 0,
          targetTokenHub: 0
        });
        const update3 = validator.generateProposePendingWithdrawal(update2, convert.Withdrawal("bn", withdrawal));
        update3.sigUser = await getSig(update3, viewer);
        const tx2 = await hubAuthorizedUpdate(update3, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update3, tx2, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert(totalChannelToken.eq(toBN(0)));

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 7)));
      });

      it("commit an update on an unresolved pending state", async () => {
        // setup - need token in the channel first
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenUser: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        const confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });
        confirmed.sigUser = await getSig(confirmed, viewer);
        confirmed.sigHub = await getSig(confirmed, hub);

        // 1. propose new pending deposit, sign, but don't commit
        const deposit2 = getDepositArgs("empty", {
          ...confirmed,
          depositTokenUser: 15
        });
        const update2 = sg.proposePendingDeposit(confirmed, deposit2);
        update2.sigUser = await getSig(update2, viewer);

        // 2. generate payment update on the pending state and commit
        const payment = getPaymentArgs("empty", {
          ...update2,
          amountWei: 0,
          amountToken: 3,
          recipient: "hub"
        });
        const update3 = validator.generateChannelPayment(update2, payment);
        update3.sigUser = await getSig(update3, viewer);
        update3.sigHub = await getSig(update3, hub);

        const tx2 = await hubAuthorizedUpdate(update3, hub, 0);

        await verifyHubAuthorizedUpdate(viewer, update3, tx2, true);

        const totalChannelToken = await cm.totalChannelToken.call();
        assert(totalChannelToken.eq(toBN(25)));

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 25)));
      });
    });

    describe("failing requires", () => {
      // Tests based on the initial happy case where the hub deposits 10 wei

      it("fails when sent wei (no payable)", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        // sending 20 wei
        await hubAuthorizedUpdate(update, hub, 20).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert");
      });

      it("fails when msg.sender is not hub", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        // sending as viewer
        await hubAuthorizedUpdate(update, viewer, 0).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert");
      });

      it('hubAuthorizedUpdate - fails when channel status is not "Open"', async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        await startExit(update, viewer, 0);
        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("channel must be open.");
      });

      it("fails when timeout expired", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
          timeout: secondsFromNow(0) // timeout is now
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("the timeout must be zero or not have passed");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 1 - txCount[0] = channel.txCount[0]

        // First submit a deposit at default txCountGlobal = 0
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        await hubAuthorizedUpdate(update, hub, 0);

        // Then submit another deposit at the same txCountGlobal = 0
        // (will be the same because we're using the same initital state to gen)
        const newUpdate = sg.proposePendingDeposit(state, deposit);
        newUpdate.sigUser = await getSig(newUpdate, viewer);

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 2 - txCount[0] < channel.txCount[0]

        // First submit a deposit with txCountGlobal = 1
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.txCountGlobal = 1;
        update.sigUser = await getSig(update, viewer);
        await hubAuthorizedUpdate(update, hub, 0);

        // Then submit another deposit with txCountGlobal = 0
        const newUpdate = sg.proposePendingDeposit(state, deposit);
        newUpdate.txCountGlobal = 0;
        newUpdate.sigUser = await getSig(newUpdate, viewer);

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount");
      });

      it("fails when txCount[1] < channel.txCount[1]", async () => {
        //First submit a deposit at default txCountChain
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        //txCountGlobal = 1
        update.txCountChain = 1;
        update.sigUser = await getSig(update, viewer);
        await hubAuthorizedUpdate(update, hub, 0);

        // Then submit another deposit at the same txCountChain
        const newUpdate = sg.proposePendingDeposit(state, deposit);
        newUpdate.txCountGlobal = 2; // have to increment global count here to pass above test
        newUpdate.txCountChain = 0;
        newUpdate.sigUser = await getSig(newUpdate, viewer);

        await hubAuthorizedUpdate(newUpdate, hub, 0).should.be.rejectedWith("onchain txCount must be higher or equal to the current onchain txCount");
      });

      it("fails when wei is not conserved", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.balanceWeiHub = 20;
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("wei must be conserved");
      });

      it("fails when token are not conserved", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.balanceTokenHub = 20;
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("tokens must be conserved");
      });

      it("fails when insufficient reserve wei", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 1001
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("insufficient reserve wei for deposits");
      });

      it("fails when insufficient reserve token", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 1001
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("insufficient reserve tokens for deposits");
      });

      it("fails when current total channel wei + both deposits is less than final balances + withdrawals", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.pendingWithdrawalWeiUser = 20; //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("insufficient wei");
      });

      it("fails when current total channel token + both deposits is less than final balances + withdrawals", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositTokenHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.pendingWithdrawalTokenUser = 20; //also tested here with hub withdrawal
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("insufficient token");
      });

      it("fails when user is hub", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.user = hub.address;
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("user can not be hub");
      });

      it("fails when user is contract", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        update.user = cm.address;
        update.sigUser = await getSig(update, viewer);

        await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("user can not be channel manager");
      });

      it("fails when user signature is incorrect (long test)", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10
        });
        const update = sg.proposePendingDeposit(state, deposit);
        const sigArrayUser = await generateIncorrectSigs(update, viewer);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayUser.length; i++) {
          update.sigUser = sigArrayUser[i];
          // console.log("Now testing signature: " + update.sigUser)
          await hubAuthorizedUpdate(update, hub, 0).should.be.rejectedWith("user signature invalid");
        }
      });
    });

    describe("edge cases", () => {
      it("wei/token user/hub deposit > withdrawal > 0", async () => {
        const update = {
          ...state,
          pendingDepositWeiHub: 2,
          pendingWithdrawalWeiHub: 1,
          pendingDepositWeiUser: 5,
          pendingWithdrawalWeiUser: 3,
          pendingDepositTokenHub: 6,
          pendingWithdrawalTokenHub: 4,
          pendingDepositTokenUser: 13,
          pendingWithdrawalTokenUser: 7,
          txCountGlobal: state.txCountGlobal + 1,
          txCountChain: state.txCountChain + 1
        };

        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update, tx, true);

        // deposits - withdrawals
        // 2 + 5 - 1 - 3 = 3
        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 3);

        // initial - deposits + hub withdrawals
        // initial - (2 + 5) + 1
        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 6)));

        // deposits - withdrawals
        // 6 + 13 - 4 - 7 = 8
        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 8);

        // initial - deposits + hub withdrawals
        // initial - (6 + 13) + 4
        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 15)));
      });

      it("wei/token user/hub withdrawal > deposit > 0", async () => {
        const deposit = getDepositArgs("empty", {
          ...state,
          depositWeiHub: 10,
          depositWeiUser: 11,
          depositTokenHub: 12,
          depositTokenUser: 13,
          timeout: 0
        });
        const update = validator.generateProposePendingDeposit(state, deposit);
        update.sigUser = await getSig(update, viewer);
        const tx = await hubAuthorizedUpdate(update, hub, 0);

        confirmed = await validator.generateConfirmPending(update, {
          transactionHash: tx.tx
        });

        const pending = getPendingArgs("empty", {
          ...confirmed,
          depositWeiUser: 3,
          depositWeiHub: 1,
          depositTokenUser: 7,
          depositTokenHub: 4,
          withdrawalWeiUser: 5,
          withdrawalWeiHub: 2,
          withdrawalTokenUser: 13,
          withdrawalTokenHub: 6,
          timeout: 0
        });

        const update2 = sg.proposePending(confirmed, convert.ProposePending("bn", pending));
        // TODO use validator
        // const update2 = validator.generateProposePending(confirmed, pending)

        update2.sigUser = await getSig(update2, viewer);
        const tx2 = await hubAuthorizedUpdate(update2, hub, 0);
        await verifyHubAuthorizedUpdate(viewer, update2, tx2, true);

        // initial balance + deposits - withdrawals
        // 10 + 11 + 1 + 3 - 2 - 5 = 18
        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 18);

        // initial reserve - deposit1 - deposit2 + hub withdrawals
        // initial - (10 + 11) - (1 + 3) + 2 = initial - 23
        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 23)));

        // initial balance + deposits - withdrawals
        // 12 + 13 + 4 + 7 - 6 - 13 = 17
        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 17);

        // initial reserve - deposit1 - deposit2 + hub withdrawals
        // initial - (12 + 13) - (4 + 7) + 6 = initial - 30
        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 30)));
      });

      describe("performer collateral/tip/withdraw", () => {
        beforeEach(async () => {
          // hub collateralize
          const deposit = getDepositArgs("empty", {
            ...state,
            depositTokenHub: 12,
            timeout: 0
          });
          const update = validator.generateProposePendingDeposit(state, deposit);
          update.sigUser = await getSig(update, viewer);
          const tx = await hubAuthorizedUpdate(update, hub, 0);

          confirmed = await validator.generateConfirmPending(update, {
            transactionHash: tx.tx
          });
          confirmed.sigHub = await getSig(confirmed, hub);

          // performer receives a tip
          const payment = getPaymentArgs("empty", {
            ...confirmed,
            amountWei: 0,
            amountToken: 2,
            recipient: "user"
          });
          const update2 = validator.generateChannelPayment(confirmed, payment);
          update2.sigHub = await getSig(update2, hub);

          state = update2;
        });

        it("withdraw to user account", async () => {
          // performer withdraws in ETH, hub empties channel as well
          const withdrawal = getWithdrawalArgs("empty", {
            ...state,
            targetWeiUser: 0,
            targetWeiHub: 0,
            targetTokenUser: 0,
            targetTokenHub: 0,
            tokensToSell: 2,
            exchangeRate: "2"
          });
          const update = sg.proposePendingWithdrawal(convert.ChannelState("bn", state), convert.Withdrawal("bn", withdrawal));

          update.sigUser = await getSig(update, viewer);

          const tx = await hubAuthorizedUpdate(update, hub, 0);
          await verifyHubAuthorizedUpdate(viewer, update, tx, true);

          const totalChannelWei = await cm.totalChannelWei.call();
          assert.equal(+totalChannelWei, 0);

          // 1 wei should have been sent to the performer
          // tip 2 booty -> exchange 2/1 for 1 wei
          const hubReserveWei = await cm.getHubReserveWei();
          assert(hubReserveWei.eq(toBN(initHubReserveWei - 1)));

          const totalChannelToken = await cm.totalChannelToken.call();
          assert.equal(+totalChannelToken, 0);

          const hubReserveToken = await cm.getHubReserveTokens();
          assert(hubReserveToken.eq(toBN(initHubReserveToken)));
        });

        it("withdraw to recipient account", async () => {
          // performer withdraws in ETH, hub empties channel as well
          const withdrawal = getWithdrawalArgs("empty", {
            ...state,
            targetWeiUser: 0,
            targetWeiHub: 0,
            targetTokenUser: 0,
            targetTokenHub: 0,
            tokensToSell: 2,
            exchangeRate: "2",
            recipient: someAddress
          });
          const update = sg.proposePendingWithdrawal(convert.ChannelState("bn", state), convert.Withdrawal("bn", withdrawal));

          update.sigUser = await getSig(update, viewer);

          const tx = await hubAuthorizedUpdate(update, hub, 0);
          await verifyHubAuthorizedUpdate(viewer, update, tx, true);

          const totalChannelWei = await cm.totalChannelWei.call();
          assert.equal(+totalChannelWei, 0);

          // 1 wei should have been sent to the performer
          // tip 2 booty -> exchange 2/1 for 1 wei
          const hubReserveWei = await cm.getHubReserveWei();
          assert(hubReserveWei.eq(toBN(initHubReserveWei - 1)));

          const totalChannelToken = await cm.totalChannelToken.call();
          assert.equal(+totalChannelToken, 0);

          const hubReserveToken = await cm.getHubReserveTokens();
          assert(hubReserveToken.eq(toBN(initHubReserveToken)));

          recipientBalance = await web3.eth.getBalance(someAddress);
          assert.equal(recipientBalance, 1);
        });
      });
    });
  });

  describe("startExit", () => {
    beforeEach(async () => {
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        timeout: minutesFromNow(5)
      });
      const update = validator.generateProposePendingDeposit(state, deposit);

      update.sigHub = await getSig(update, hub);
      const tx = await userAuthorizedUpdate(update, viewer, 10);

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      });

      // initial state is the confirmed values with txCountGlobal rolled back
      state = {
        ...confirmed,
        txCountGlobal: confirmed.txCountGlobal - 1
      };
    });

    describe("happy case", () => {
      it("start exit as user", async () => {
        const tx = await startExit(state, viewer, 0);

        await verifyStartExit(viewer, state, tx, false);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 10);
      });

      it("start exit as hub", async () => {
        const tx = await startExit(state, hub, 0);

        await verifyStartExit(viewer, state, tx, true);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 10);
      });
    });

    describe("failing requires", () => {
      it("fails when user is hub", async () => {
        state.user = hub.address;
        const tx = await startExit(state, viewer, 0).should.be.rejectedWith("user can not be hub");
      });

      it("fails when user is contract", async () => {
        state.user = cm.address;
        const tx = await startExit(state, viewer, 0).should.be.rejectedWith("user can not be channel manager");
      });

      it("fails when channel is not open", async () => {
        //first, start exit on the channel
        const tx = await startExit(state, viewer, 0);
        await verifyStartExit(viewer, state, tx, false);

        //then, try exiting again
        await startExit(state, viewer, 0).should.be.rejectedWith("channel must be open");
      });

      it("fails when exit initiator is not user or hub", async () => {
        const tx = await startExit(state, performer, 0).should.be.rejectedWith("exit initiator must be user or hub");
      });
    });

    describe("edge cases", () => {
      it("startExit a zero state", async () => {
        // This is already tested in the userAuthUpdate and hubAuthUpdate
        // "channel status is not open" tests
      });

      it("successfully startExit twice in a row", async () => {
        //First startExit with any state and empty
        await startExit(state, viewer, 0);
        await emptyChannel(state, hub, 0);
        await verifyChannelBalances(viewer, zeroBalances(state));

        //Then try starting exit again (this time with zero balances)
        const tx = await startExit(zeroBalances(state), viewer, 0);
        await verifyStartExit(viewer, zeroBalances(state), tx, false);
      });
    });
  });

  describe("startExitWithUpdate", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      initHubReserveWei = await cm.getHubReserveWei();
      initHubReserveToken = await cm.getHubReserveTokens();

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        depositTokenUser: 11,
        depositWeiHub: 12,
        depositTokenHub: 13,
        timeout: minutesFromNow(5)
      });
      const update = validator.generateProposePendingDeposit(state, deposit);

      update.sigUser = await getSig(update, viewer);
      const tx = await hubAuthorizedUpdate(update, hub, 0);

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      });
      confirmed.sigUser = await getSig(confirmed, viewer);
      confirmed.sigHub = await getSig(confirmed, hub);

      // initial state is the confirmed values with txCountGlobal rolled back
      state = {
        ...confirmed,
        txCountGlobal: confirmed.txCountGlobal - 1
      };
    });

    describe("happy case", () => {
      it("startExitWithUpdate as user", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        const tx = await startExitWithUpdate(update, viewer, 0);

        await verifyStartExit(viewer, update, tx, false);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 22);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 22)));

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 24);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 24)));
      });

      it("startExitWithUpdate as hub", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        // send as hub
        const tx = await startExitWithUpdate(update, hub, 0);

        await verifyStartExit(viewer, update, tx, true);

        const totalChannelWei = await cm.totalChannelWei.call();
        assert.equal(+totalChannelWei, 22);

        const hubReserveWei = await cm.getHubReserveWei();
        assert(hubReserveWei.eq(toBN(initHubReserveWei - 22)));

        const totalChannelToken = await cm.totalChannelToken.call();
        assert.equal(+totalChannelToken, 24);

        const hubReserveToken = await cm.getHubReserveTokens();
        assert(hubReserveToken.eq(toBN(initHubReserveToken - 24)));
      });
    });

    describe("failing requires", () => {
      it("fails when channel is not open", async () => {
        //first, start exit on the channel
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        const tx = await startExitWithUpdate(update, viewer, 0);

        await verifyStartExit(viewer, update, tx, false);

        //then, try exiting again
        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("channel must be open");
      });

      it("fails when sender is not hub or user", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await startExitWithUpdate(update, performer, 0).should.be.rejectedWith("exit initiator must be user or hub");
      });

      it("fails when timeout is nonzero", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);
        update.timeout = 1;

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("can't start exit with time-sensitive states");
      });

      it("fails when user is hub", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);
        update.user = hub.address;

        await startExitWithUpdate(update, hub, 0).should.be.rejectedWith("user can not be hub");
      });

      it("fails when user is hub", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);
        update.user = cm.address;

        await startExitWithUpdate(update, hub, 0).should.be.rejectedWith("user can not be channel manager");
      });

      it("fails when hub signature is incorrect (long test)", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        const sigArrayHub = await generateIncorrectSigs(update, hub);
        update.sigUser = await getSig(update, viewer);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayHub.length; i++) {
          update.sigHub = sigArrayHub[i];
          // console.log("Now testing signature: " + update.sigHub)
          await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("hub signature invalid");
        }
      });

      it("fails when user signature is incorrect (long test)", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        const sigArrayUser = await generateIncorrectSigs(update, viewer);
        update.sigHub = await getSig(update, hub);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayUser.length; i++) {
          update.sigUser = sigArrayUser[i];
          // console.log("Now testing signature: " + update.sigUser)
          await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("user signature invalid");
        }
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 1 - txCount[0] = channel.txCount[0]
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountGlobal onchain is 1 because we've done one deposit before dispute
        update.txCountGlobal = 1;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount.");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 2 - txCount[0] < channel.txCount[0]
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountGlobal onchain is 1 because we've done one deposit before dispute
        update.txCountGlobal = 0;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount.");
      });

      it("fails when txCount[1] < channel.txCount[1]", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountChain onchain is 1 because we've done one deposit before dispute
        update.txCountChain = 0;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith(
          "onchain txCount must be higher or equal to the current onchain txCount."
        );
      });

      it("fails when wei is not conserved", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.balanceWeiUser = 20;
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("wei must be conserved");
      });

      it("fails when token are not conserved", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.balanceTokenUser = 20;
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);

        await startExitWithUpdate(update, viewer, 0).should.be.rejectedWith("tokens must be conserved");
      });
    });

    describe("edge cases", () => {});
  });

  describe("emptyChannelWithChallenge", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      initHubReserveWei = await cm.getHubReserveWei();
      initHubReserveToken = await cm.getHubReserveTokens();

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        depositTokenUser: 11,
        depositWeiHub: 12,
        depositTokenHub: 13,
        timeout: minutesFromNow(5)
      });
      const update = validator.generateProposePendingDeposit(state, deposit);

      update.sigUser = await getSig(update, viewer);
      const tx = await hubAuthorizedUpdate(update, hub, 0);

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      });
      confirmed.sigUser = await getSig(confirmed, viewer);
      confirmed.sigHub = await getSig(confirmed, hub);

      // initial state is the confirmed values with txCountGlobal rolled back
      state = { ...confirmed };
    });

    it("challenge after viewer startExit", async () => {
      await startExit(state, viewer, 0);
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      const payment = getPaymentArgs("empty", {
        ...state,
        amountWei: 3,
        amountToken: 0,
        recipient: "hub"
      });
      const update = validator.generateChannelPayment(state, payment);
      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      const tx = await emptyChannelWithChallenge(update, hub, 0);

      update.userWeiTransfer = 7; // initial user balance (10) - payment (3)
      update.userTokenTransfer = 11; // initial user balance (11)
      update.initHubReserveWei = initHubReserveWei;
      update.initHubReserveToken = initHubReserveToken;

      await verifyEmptyChannel(viewer, update, tx, true);
    });

    // 1. generate pending (#1)
    // 2. startExit (#0)
    // 3. emptyChannelWithChallenge (#1)
    it("challenge with pending deposits after viewer startExit", async () => {
      await startExit(state, viewer, 0);
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 5,
        depositTokenUser: 54,
        depositWeiHub: 49,
        depositTokenHub: 2,
        timeout: 0
      });

      const update = sg.proposePendingDeposit(state, deposit);

      // TODO fix to use validator once timeouts are optional on deposits
      // const update = validator.generateProposePendingDeposit(state, deposit)
      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      const tx = await emptyChannelWithChallenge(update, hub, 0);

      update.userWeiTransfer = 10; // initial user balance (10)
      update.userTokenTransfer = 11; // initial user balance (11)
      update.initHubReserveWei = initHubReserveWei;
      update.initHubReserveToken = initHubReserveToken;
      update.txCountChain = update.txCountChain - 1; // revert onchain operation

      await verifyEmptyChannel(viewer, update, tx, true);
    });

    it("challenge with withdrawals after viewer startExit", async () => {
      await startExit(state, viewer, 0);
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      const withdrawal = getWithdrawalArgs("empty", {
        ...state,
        targetWeiUser: 0,
        targetWeiHub: 1,
        targetTokenUser: 3,
        targetTokenHub: 4
      });
      const update = sg.proposePendingWithdrawal(convert.ChannelState("bn", state), convert.Withdrawal("bn", withdrawal));

      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      const tx = await emptyChannelWithChallenge(update, hub, 0);

      // user/hub withdrawn balances should reflect initial balance
      update.userWeiTransfer = 10; // initial user balance (10)
      update.userTokenTransfer = 11; // initial user balance (11)
      update.initHubReserveWei = initHubReserveWei;
      update.initHubReserveToken = initHubReserveToken;
      update.txCountChain = update.txCountChain - 1; // revert onchain operation

      await verifyEmptyChannel(viewer, update, tx, true);
    });

    it("challenge with withdrawals > deposits after viewer startExit", async () => {
      await startExit(state, viewer, 0);
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      const pending = getPendingArgs("empty", {
        ...state,
        depositWeiUser: 12,
        depositWeiHub: 5,
        depositTokenUser: 19,
        depositTokenHub: 7,
        withdrawalWeiUser: 14,
        withdrawalWeiHub: 9,
        withdrawalTokenUser: 21,
        withdrawalTokenHub: 17
      });

      const update = sg.proposePending(state, convert.ProposePending("bn", pending));

      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      const tx = await emptyChannelWithChallenge(update, hub, 0);

      update.userWeiTransfer = 10; // initial user balance (10)
      update.userTokenTransfer = 11; // initial user balance (11)
      update.initHubReserveWei = initHubReserveWei;
      update.initHubReserveToken = initHubReserveToken;
      update.txCountChain = update.txCountChain - 1; // revert onchain operation

      await verifyEmptyChannel(viewer, update, tx, true);
    });

    // start exit w/ commited pending update, challenge with later update
    // 1. generate pending (#1)
    // 2. channel update (#2 - does not resolve pending)
    // 3. commit #1 via authorized update
    // 4. startExit (uses #1)
    // 5. emptyChannelWithChallenge (#2)
    it("challenge with a valid update on a committed pending state", async () => {
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      // 1. generate, and sign a pending update
      const pending = getPendingArgs("empty", {
        ...state,
        depositWeiUser: 5,
        depositTokenUser: 54,
        depositWeiHub: 49,
        depositTokenHub: 2,
        withdrawalWeiUser: 10, // 10 > 5 -> delta deducted from balance
        timeout: 0
      });

      const update = sg.proposePending(state, convert.ProposePending("bn", pending));
      update.sigUser = await getSig(update, viewer);

      // 2. generate a valid payment update on the pending deposit update
      const payment = getPaymentArgs("empty", {
        ...update,
        amountWei: 3, // should have 5 in channel (10 - (10 - 5)) - fails with > 5
        amountToken: 0,
        recipient: "hub"
      });

      const update2 = validator.generateChannelPayment(update, payment);
      update2.sigUser = await getSig(update2, viewer);
      update2.sigHub = await getSig(update2, hub);

      // 3. commit the pending deposit update
      await hubAuthorizedUpdate(update, hub, 0);

      // 4. start exit with the pending deposit update
      await startExit(update, viewer, 0);

      // set the user initial wei balance here b/c they pay startExit gas
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);

      // 5. challenge with the payment update
      const tx = await emptyChannelWithChallenge(update2, hub, 0);

      // user/hub withdrawn balances should account for committed pending ops
      update2.userWeiTransfer = 12; // deposit 10, deposit 5, spend 3
      update2.userTokenTransfer = 65; // deposit 11, deposit 54
      update2.initHubReserveWei = initHubReserveWei;
      update2.initHubReserveToken = initHubReserveToken;

      await verifyEmptyChannel(viewer, update2, tx, true);
    });

    // startExitWithUpdate pending, challenge with later update
    // 1. generate pending (#1)
    // 2. channel update (#2 - does not resolve pending)
    // 3. commit #1 via startExitWithUpdate
    // 4. emptyChannelWithChallenge (#2)
    it("challenge with a valid update on a startExitWithUpdate pending state", async () => {
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      // 1. generate, and sign a pending deposit update
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 5,
        depositTokenUser: 54,
        depositWeiHub: 49,
        depositTokenHub: 2,
        timeout: 0
      });

      const update = sg.proposePendingDeposit(state, deposit);
      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      // 2. generate a valid payment update on the pending deposit update
      const payment = getPaymentArgs("empty", {
        ...update,
        amountWei: 3,
        amountToken: 0,
        recipient: "hub"
      });

      const update2 = validator.generateChannelPayment(update, payment);
      update2.sigUser = await getSig(update2, viewer);
      update2.sigHub = await getSig(update2, hub);

      // 3. start exit with the pending deposit update
      await startExitWithUpdate(update, viewer, 0);

      // set the user initial wei balance here b/c they pay startExit gas
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);

      // 4. challenge with the payment update
      const tx = await emptyChannelWithChallenge(update2, hub, 0);

      // user/hub withdrawn balances should reflect initial balance and payment
      update2.userWeiTransfer = 7; // initial user balance (10) - payment (3)
      update2.userTokenTransfer = 11; // initial user balance (11)
      update2.initHubReserveWei = initHubReserveWei;
      update2.initHubReserveToken = initHubReserveToken;
      update2.txCountChain = update.txCountChain - 1; // revert onchain operation

      await verifyEmptyChannel(viewer, update2, tx, true);
    });

    // 1. generate pending (#1)
    // 2. channel update (#2 - does not resolve pending)
    // 3. channel update again (#3 - does not resolve pending)
    // 4. commit #1 via authorized update
    // 5. startExitWithUpdate (uses #2)
    // 6. emptyChannelWithChallenge (#3)
    it("challenge a startExitWithUpdate update on a pending state", async () => {
      viewer.initTokenBalance = await token.balanceOf(viewer.address);

      // 1. generate, and sign a pending deposit update
      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 5,
        depositTokenUser: 54,
        depositWeiHub: 49,
        depositTokenHub: 2,
        timeout: 0
      });

      const update = sg.proposePendingDeposit(state, deposit);
      update.sigUser = await getSig(update, viewer);
      update.sigHub = await getSig(update, hub);

      // 2. generate a valid payment update on the pending deposit update
      const payment = getPaymentArgs("empty", {
        ...update,
        amountWei: 3,
        amountToken: 0,
        recipient: "hub"
      });

      const update2 = validator.generateChannelPayment(update, payment);
      update2.sigUser = await getSig(update2, viewer);
      update2.sigHub = await getSig(update2, hub);

      // 3. generate another valid payment update on the pending deposit update
      const payment2 = getPaymentArgs("empty", {
        ...update2,
        amountWei: 0,
        amountToken: 5,
        recipient: "hub"
      });

      const update3 = validator.generateChannelPayment(update2, payment2);
      update3.sigUser = await getSig(update3, viewer);
      update3.sigHub = await getSig(update3, hub);

      // 4. start exit with the first payment
      await startExitWithUpdate(update2, viewer, 0);

      // set the user initial wei balance here b/c they pay startExit gas
      viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);

      // 5. challenge with the second payment
      const tx = await emptyChannelWithChallenge(update3, hub, 0);

      // user/hub withdrawn balances should reflect initial balance and payment
      update3.userWeiTransfer = 7; // initial user balance (10) - payment (3)
      update3.userTokenTransfer = 6; // initial user balance (11) - payment (5)
      update3.initHubReserveWei = initHubReserveWei;
      update3.initHubReserveToken = initHubReserveToken;
      update3.txCountChain = update.txCountChain - 1; // revert onchain operation

      await verifyEmptyChannel(viewer, update3, tx, true);
    });

    describe("failing requires", () => {
      //these will all be tested with the startExit base case

      it("Fails when channel is not in dispute status", async () => {
        //call emptyChannelWithChallenge without first calling startExit
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("channel must be in dispute");
      });

      it("Fails when the closing time has passed", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);
        //move forward until closing time has passed
        await moveForwardSecs(challengePeriod + 1);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("channel closing time must not have passed");
      });

      it("Fails when the sender initiated the exit", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, viewer, 0).should.be.rejectedWith("challenger can not be exit initiator.");
      });

      it("Fails when the sender is not either the hub or submitted user", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, performer, 0).should.be.rejectedWith("challenger must be either user or hub.");
      });

      it("Fails when timeout is nonzero", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.timeout = 1;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("can't start exit with time-sensitive states.");
      });

      //Not possible to test. If we set user = hub, this will fail the "channel must be in dispute" test
      it("Fails when user is hub", async () => {});

      //Not possible to test. If we set user = cm, this will fail the "channel must be in dispute" test
      it("Fails when user is channel manager", async () => {});

      it("fails when hub signature is incorrect (long test)", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        const sigArrayHub = await generateIncorrectSigs(update, hub);
        update.sigUser = await getSig(update, viewer);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayHub.length; i++) {
          update.sigHub = sigArrayHub[i];
          // console.log("Now testing signature: " + update.sigHub)
          await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("hub signature invalid");
        }
      });

      it("fails when user signature is incorrect (long test)", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        const sigArrayUser = await generateIncorrectSigs(update, viewer);
        update.sigHub = await getSig(update, hub);
        //iterate over incorrect sigs and try each one to make sure it fails
        for (i = 0; i < sigArrayUser.length; i++) {
          update.sigUser = sigArrayUser[i];
          // console.log("Now testing signature: " + update.sigUser)
          await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("user signature invalid");
        }
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 1 - txCount[0] = channel.txCount[0]
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountGlobal onchain is 1 because we've done one deposit before dispute
        update.txCountGlobal = 1;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount.");
      });

      it("fails when txCount[0] <= channel.txCount[0]", async () => {
        // Part 2 - txCount[0] < channel.txCount[0]
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountGlobal onchain is 1 because we've done one deposit before dispute
        update.txCountGlobal = 0;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("global txCount must be higher than the current global txCount.");
      });

      it("fails when txCount[1] < channel.txCount[1]", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        //curent txCountChain onchain is 1 because we've done one deposit before dispute
        update.txCountChain = 0;
        update.sigUser = await getSig(update, viewer);
        update.sigHub = await getSig(update, hub);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith(
          "onchain txCount must be higher or equal to the current onchain txCount."
        );
      });

      it("fails when wei is not conserved", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.balanceWeiUser = 20;
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("wei must be conserved");
      });

      it("fails when token are not conserved", async () => {
        await startExit(state, viewer, 0);
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 3,
          amountToken: 0,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.balanceTokenUser = 20;
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);

        await emptyChannelWithChallenge(update, hub, 0).should.be.rejectedWith("tokens must be conserved");
      });
    });
  });

  describe("emptyChannel", () => {
    beforeEach(async () => {
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      initHubReserveWei = await cm.getHubReserveWei();
      initHubReserveToken = await cm.getHubReserveTokens();

      const deposit = getDepositArgs("empty", {
        ...state,
        depositWeiUser: 10,
        depositTokenUser: 11,
        depositWeiHub: 12,
        depositTokenHub: 13,
        timeout: minutesFromNow(5)
      });
      const update = validator.generateProposePendingDeposit(state, deposit);

      update.sigUser = await getSig(update, viewer);
      const tx = await hubAuthorizedUpdate(update, hub, 0);

      confirmed = await validator.generateConfirmPending(update, {
        transactionHash: tx.tx
      });
      confirmed.sigUser = await getSig(confirmed, viewer);
      confirmed.sigHub = await getSig(confirmed, hub);

      // initial state is the confirmed values with txCountGlobal rolled back
      state = {
        ...confirmed,
        txCountGlobal: confirmed.txCountGlobal - 1
      };
    });

    describe("happy case", () => {
      it("empty after viewer startExit", async () => {
        await startExit(state, viewer, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        const tx = await emptyChannel(state, hub, 0);
        state.userWeiTransfer = 10; // initial user balance (10)
        state.userTokenTransfer = 11; // initial user balance (11)
        state.initHubReserveWei = initHubReserveWei;
        state.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, state, tx, true);
      });
    });

    describe("failing requires", () => {
      //tests done using empty after viewer startExit base
      it("Fails when user is hub", async () => {
        await startExit(state, viewer, 0);
        state.user = hub.address;
        await emptyChannel(state, hub, 0).should.be.rejectedWith("user can not be hub.");
      });

      it("Fails when user is channel manager", async () => {
        await startExit(state, viewer, 0);
        state.user = cm.address;
        await emptyChannel(state, hub, 0).should.be.rejectedWith("user can not be channel manager.");
      });

      it("Fails when channel is not in dispute status", async () => {
        await emptyChannel(state, hub, 0).should.be.rejectedWith("channel must be in dispute.");
      });

      it("Fails when channel closing time has not passed and sender is the initiator", async () => {
        await startExit(state, viewer, 0);
        await emptyChannel(state, viewer, 0).should.be.rejectedWith(
          "channel closing time must have passed or msg.sender must be non-exit-initiating party."
        );
      });

      //This is actually impossible to test:
      // 1. This req fails if there is insuffient token to send to user
      // 2. The amount of token to be sent to user is determined by previously recorded onchain state
      // 3. The singularly valid previously recorded onchain states are ones where there is enough reserve tokens
      //    to allow for this withdrawal to occur.
      //
      // Theoretically, the way this fails is if we get hacked or if the token is not actually erc20
      it("Fails if token transfer fails", async () => {});
    });

    describe("edge cases", () => {
      it("hub empty after viewer startExit", async () => {
        await startExit(state, viewer, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        const tx = await emptyChannel(state, hub, 0);
        state.userWeiTransfer = 10; // initial user balance (10)
        state.userTokenTransfer = 11; // initial user balance (11)
        state.initHubReserveWei = initHubReserveWei;
        state.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, state, tx, true);
      });

      it("viewer empty after hub startExit", async () => {
        await startExit(state, hub, 0);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        const tx = await emptyChannel(state, viewer, 0);
        state.userWeiTransfer = 10; // initial user balance (10)
        state.userTokenTransfer = 11; // initial user balance (11)
        state.initHubReserveWei = initHubReserveWei;
        state.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, state, tx, false, false);
      });

      it("viewer empty after viewer startExit and timeout expires", async () => {
        const tx_exit = await startExit(state, viewer, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        await moveForwardSecs(challengePeriod * 2);

        const tx = await emptyChannel(state, viewer, 0);
        state.userWeiTransfer = 10; // initial user balance (10)
        state.userTokenTransfer = 11; // initial user balance (11)
        state.initHubReserveWei = initHubReserveWei;
        state.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, state, tx, false, false);
      });

      it("hub empty after hub startExit and timeout expires", async () => {
        await startExit(state, hub, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        await moveForwardSecs(challengePeriod * 2);

        const tx = await emptyChannel(state, hub, 0);
        state.userWeiTransfer = 10; // initial user balance (10)
        state.userTokenTransfer = 11; // initial user balance (11)
        state.initHubReserveWei = initHubReserveWei;
        state.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, state, tx, true);
      });

      it.skip("hub empty after viewer startExitWithUpdate", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 5,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);
        await startExitWithUpdate(update, viewer, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        const tx = await emptyChannel(state, hub, 0);
        update.userWeiTransfer = 5; // initial user balance (10) - spent (5)
        update.userTokenTransfer = 11; // initial user balance (11)
        update.initHubReserveWei = initHubReserveWei;
        update.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, update, tx, true);
      });

      it("user empty after hub startExitWithUpdate", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 5,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);
        await startExitWithUpdate(update, hub, 0);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        const tx = await emptyChannel(state, viewer, 0);
        update.userWeiTransfer = 5; // initial user balance (10) - spent (5)
        update.userTokenTransfer = 11; // initial user balance (11)
        update.initHubReserveWei = initHubReserveWei;
        update.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, update, tx, false, false);
      });

      it("hub empty after hub startExitWithUpdate and timeout expires", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 5,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);
        await startExitWithUpdate(update, hub, 0);
        viewer.initWeiBalance = await web3.eth.getBalance(viewer.address);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        await moveForwardSecs(challengePeriod * 2);

        const tx = await emptyChannel(state, hub, 0);
        update.userWeiTransfer = 5; // initial user balance (10) - spent (5)
        update.userTokenTransfer = 11; // initial user balance (11)
        update.initHubReserveWei = initHubReserveWei;
        update.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, update, tx, true);
      });

      it("viewer empty after viewer startExitWithUpdate and timeout expires", async () => {
        const payment = getPaymentArgs("empty", {
          ...state,
          amountWei: 5,
          recipient: "hub"
        });
        const update = validator.generateChannelPayment(state, payment);
        update.sigHub = await getSig(update, hub);
        update.sigUser = await getSig(update, viewer);
        await startExitWithUpdate(update, viewer, 0);
        viewer.initTokenBalance = await token.balanceOf(viewer.address);

        await moveForwardSecs(challengePeriod * 2);

        const tx = await emptyChannel(state, viewer, 0);
        update.userWeiTransfer = 5; // initial user balance (10) - spent (5)
        update.userTokenTransfer = 11; // initial user balance (11)
        update.initHubReserveWei = initHubReserveWei;
        update.initHubReserveToken = initHubReserveToken;
        await verifyEmptyChannel(viewer, update, tx, false, false);
      });
    });
  });

  describe("startExitThread", () => {
    let threadState;
    let channelStateWithThreadsSender;
    let channelStateWithThreadsReceiver;

    // assert that balances and threadClosingTime is set appropriately in success case
    const happyAssertions = async threadState => {
      const thread = await cm.getThread(threadState.sender, threadState.receiver, threadState.threadId);
      assert(thread.weiSender.eq(toBN(threadState.balanceWeiSender)));
      assert(thread.weiReceiver.eq(toBN(threadState.balanceWeiReceiver)));
      assert(thread.tokenSender.eq(toBN(threadState.balanceTokenSender)));
      assert(thread.tokenReceiver.eq(toBN(threadState.balanceTokenReceiver)));
      assert(thread.txCount.eq(toBN(0)));
      assert(thread.threadClosingTime.gte(toBN(Math.floor(Date.now() / 1000) + data.channelManager.challengePeriod - 5))); // subtract 5 in case test takes too long and second rolls over
      thread.emptiedSender.should.be.false;
      thread.emptiedReceiver.should.be.false;
    };

    beforeEach(async () => {
      // initialize emptied channels on both sides of thread
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      threadState = {
        contractAddress: cm.address.toLowerCase(),
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 10,
        balanceWeiReceiver: 0,
        balanceTokenSender: 10,
        balanceTokenReceiver: 0,
        txCount: 0
      };
      threadState.sigA = await getThreadSig(threadState, viewer);

      // sender
      channelStateWithThreadsSender = await fastForwardToEmptiedChannel(state, threadState, viewer);
      let channelDetails = await cm.getChannelDetails(viewer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      // receiver
      channelStateWithThreadsReceiver = await fastForwardToEmptiedChannel(channelStateReceiver, threadState, performer);
      channelDetails = await cm.getChannelDetails(performer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));
    });

    describe("happy paths", () => {
      it("succeeds if sender starts to exit thread", async () => {
        const proof = clientUtils.generateThreadProof(threadState, [threadState]);
        const sig = await getThreadSig(threadState, viewer);

        await startExitThread(channelStateWithThreadsSender, threadState, proof, sig, viewer);
        await happyAssertions(threadState);
      });

      it("succeeds if receiver starts to exit thread", async () => {
        const proof = clientUtils.generateThreadProof(threadState, [threadState]);

        // still need to get sig from viewer
        const sig = await getThreadSig(threadState, viewer);

        await startExitThread(channelStateWithThreadsReceiver, threadState, proof, sig, performer);
        await happyAssertions(threadState);
      });

      it("succeeds if hub starts to exit thread on sender side", async () => {
        const proof = clientUtils.generateThreadProof(threadState, [threadState]);

        // still need to get sig from viewer
        const sig = await getThreadSig(threadState, viewer);

        await startExitThread(channelStateWithThreadsSender, threadState, proof, sig, hub);
        await happyAssertions(threadState);
      });

      it("succeeds if hub starts to exit thread on receiver side", async () => {
        const proof = clientUtils.generateThreadProof(threadState, [threadState]);

        // still need to get sig from viewer
        const sig = await getThreadSig(threadState, viewer);

        await startExitThread(channelStateWithThreadsReceiver, threadState, proof, sig, hub);
        await happyAssertions(threadState);
      });
    });

    describe("edge cases", () => {
      it("succeeds if sender starts to exit thread while reciever is exiting", async () => {});
      it("succeeds if sender starts to exit thread while hub is exiting", async () => {});
    });

    describe("assertions", () => {
      it("fails if channel is not in ThreadDispute", async () => {});
      it("fails if msg.sender is not either the user or hub", async () => {});
      it("fails if the user is not the sender or receiver", async () => {});
      it("fails if the initial receiver balances are not zero", async () => {});
      it("fails if thread closing time is non-zero & dispute is underway", async () => {});
      it("fails if thread closing time is non-zero & dispute is over & thread is empty", async () => {});
      it("fails if any _verifyThread reqs fail", async () => {});

      it("fails if sender's signature is invalid (long test)", async () => {
        const timeout = minutesFromNow(5);
        const proof = clientUtils.generateThreadProof(threadState, [threadState]);
        const badSigs = await generateIncorrectThreadSigs(threadState, viewer);
        for (i = 0; i < badSigs.length; i++) {
          // console.log(`Now testing signature ${i}: ${badSigs[i]}`)
          await startExitThread(channelStateWithThreadsReceiver, threadState, proof, badSigs[i], hub).should.be.rejectedWith("signature invalid");
        }
      });
    });
  });

  describe("startExitThreadWithUpdate", () => {
    let threadStateInitial;
    let threadStateUpdated;
    let channelStateWithThreadsSender;
    let channelStateWithThreadsReceiver;

    // assert that balances, txCount and threadClosingTime are set appropriately in success case
    const happyAssertions = async threadState => {
      const thread = await cm.getThread(threadState.sender, threadState.receiver, threadState.threadId);
      assert(thread.weiSender.eq(toBN(threadState.balanceWeiSender)));
      assert(thread.weiReceiver.eq(toBN(threadState.balanceWeiReceiver)));
      assert(thread.tokenSender.eq(toBN(threadState.balanceTokenSender)));
      assert(thread.tokenReceiver.eq(toBN(threadState.balanceTokenReceiver)));
      assert(thread.txCount.eq(toBN(threadState.txCount)));
      assert(thread.threadClosingTime.gte(toBN(Math.floor(Date.now() / 1000) + data.channelManager.challengePeriod - 5))); // subtract 5 in case test takes too long and second rolls over
      thread.emptiedSender.should.be.false;
      thread.emptiedReceiver.should.be.false;
    };

    beforeEach(async () => {
      // initialize emptied channels on both sides of thread
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      threadStateInitial = {
        contractAddress: cm.address.toLowerCase(),
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 10,
        balanceWeiReceiver: 0,
        balanceTokenSender: 10,
        balanceTokenReceiver: 0,
        txCount: 0
      };
      threadStateInitial.sigA = await getThreadSig(threadStateInitial, viewer);

      // sender
      channelStateWithThreadsSender = await fastForwardToEmptiedChannel(state, threadStateInitial, viewer);
      let channelDetails = await cm.getChannelDetails(viewer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      // receiver
      channelStateWithThreadsReceiver = await fastForwardToEmptiedChannel(channelStateReceiver, threadStateInitial, performer);
      channelDetails = await cm.getChannelDetails(performer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      threadStateUpdated = {
        contractAddress: cm.address,
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 8,
        balanceWeiReceiver: 2,
        balanceTokenSender: 4,
        balanceTokenReceiver: 6,
        txCount: 3
      };
    });

    describe("happy paths", () => {
      it("succeeds when sender starts exit thread w update", async () => {
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);

        // still need to get sig from viewer
        const sigInital = await getThreadSig(threadStateInitial, viewer);
        const sigUpdated = await getThreadSig(threadStateUpdated, viewer);

        await startExitThreadWithUpdate(channelStateWithThreadsSender, threadStateInitial, threadStateUpdated, proof, sigInital, sigUpdated, viewer);
        await happyAssertions(threadStateUpdated);
      });

      it("succeeds when recipient starts exit thread w update", async () => {
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);

        // still need to get sig from viewer
        const sigInital = await getThreadSig(threadStateInitial, viewer);
        const sigUpdated = await getThreadSig(threadStateUpdated, viewer);

        await startExitThreadWithUpdate(
          channelStateWithThreadsReceiver,
          threadStateInitial,
          threadStateUpdated,
          proof,
          sigInital,
          sigUpdated,
          performer
        );
        await happyAssertions(threadStateUpdated);
      });

      it("succeeds when hub starts exit thread w update in sender channel", async () => {
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);

        // still need to get sig from viewer
        const sigInital = await getThreadSig(threadStateInitial, viewer);
        const sigUpdated = await getThreadSig(threadStateUpdated, viewer);

        await startExitThreadWithUpdate(channelStateWithThreadsSender, threadStateInitial, threadStateUpdated, proof, sigInital, sigUpdated, hub);
        await happyAssertions(threadStateUpdated);
      });

      it("succeeds when hub starts exit thread w update in recipient channel", async () => {
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);

        // still need to get sig from viewer
        const sigInital = await getThreadSig(threadStateInitial, viewer);
        const sigUpdated = await getThreadSig(threadStateUpdated, viewer);

        await startExitThreadWithUpdate(channelStateWithThreadsReceiver, threadStateInitial, threadStateUpdated, proof, sigInital, sigUpdated, hub);
        await happyAssertions(threadStateUpdated);
      });
    });

    describe("edge cases", () => {
      it("succeeds if sender starts to exit thread w update while reciever is exiting", async () => {});
      it("succeeds if sender starts to exit thread w update while hub is exiting", async () => {});
      it("succeeds if sender starts to exit thread w an update & update contains no changes", async () => {});
    });

    describe("assertions", () => {
      it("fails if channel is not in ThreadDispute", async () => {});
      it("fails if msg.sender is not either the user or hub", async () => {});
      it("fails if the user is not the sender or receiver", async () => {});
      it("fails if the initial receiver balances are not zero", async () => {});
      it("fails if thread closing time is non-zero & dispute is underway", async () => {});
      it("fails if thread closing time is non-zero & dispute is over & thread is empty", async () => {});
      it("fails if any _verifyThread reqs fail", async () => {});
      it("fails if the updateTxCount is not higher than 0", async () => {});
      it("fails if wei balances are not equal to sender's initial balance", async () => {});
      it("fails if token balances are not equal to sender's initial balance", async () => {});
      it("fails if recipient balance decreases", async () => {
        /* is this necessary? */
      });

      it("fails if sender's initial state signature is incorrect (long test)", async () => {
        const timeout = minutesFromNow(5);
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);
        const sigUpdated = await getThreadSig(threadStateUpdated, viewer);
        const badSigs = await generateIncorrectThreadSigs(threadStateInitial, viewer);
        for (i = 0; i < badSigs.length; i++) {
          // console.log(`Now testing signature ${i}: ${badSigs[i]}`)
          await startExitThreadWithUpdate(
            channelStateWithThreadsReceiver,
            threadStateInitial,
            threadStateUpdated,
            proof,
            badSigs[i],
            sigUpdated,
            hub
          ).should.be.rejectedWith("signature invalid");
        }
      });

      it("fails if sender's updated state signature is incorrect (long test)", async () => {
        const timeout = minutesFromNow(5);
        const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);
        const sigInital = await getThreadSig(threadStateInitial, viewer);
        const badSigs = await generateIncorrectThreadSigs(threadStateUpdated, viewer);
        for (i = 0; i < badSigs.length; i++) {
          // console.log(`Now testing signature ${i}: ${badSigs[i]}`)
          await startExitThreadWithUpdate(
            channelStateWithThreadsReceiver,
            threadStateInitial,
            threadStateUpdated,
            proof,
            sigInital,
            badSigs[i],
            hub
          ).should.be.rejectedWith("signature invalid");
        }
      });
    });
  });

  describe("challengeThread", () => {
    let threadStateUpdated;
    let viewerSig;

    // assert that balances and txCount are correctly set in success case
    const happyAssertions = async threadState => {
      const thread = await cm.getThread(threadState.sender, threadState.receiver, threadState.threadId);
      assert(thread.weiSender.eq(toBN(threadState.balanceWeiSender)));
      assert(thread.weiReceiver.eq(toBN(threadState.balanceWeiReceiver)));
      assert(thread.tokenSender.eq(toBN(threadState.balanceTokenSender)));
      assert(thread.tokenReceiver.eq(toBN(threadState.balanceTokenReceiver)));
      assert(thread.txCount.eq(toBN(threadState.txCount)));
      thread.emptiedSender.should.be.false;
      thread.emptiedReceiver.should.be.false;
    };

    beforeEach(async () => {
      // initialize emptied channels on both sides of thread
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      const threadStateInitial = {
        contractAddress: cm.address.toLowerCase(),
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 10,
        balanceWeiReceiver: 0,
        balanceTokenSender: 10,
        balanceTokenReceiver: 0,
        txCount: 0
      };
      threadStateInitial.sigA = await getThreadSig(threadStateInitial, viewer);

      // sender
      channelStateWithThreadsSender = await fastForwardToEmptiedChannel(state, threadStateInitial, viewer);
      let channelDetails = await cm.getChannelDetails(viewer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      // receiver
      await fastForwardToEmptiedChannel(channelStateReceiver, threadStateInitial, performer);
      channelDetails = await cm.getChannelDetails(performer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      const proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);
      const initialSig = await getThreadSig(threadStateInitial, viewer);
      await startExitThread(channelStateWithThreadsSender, threadStateInitial, proof, initialSig, viewer);

      threadStateUpdated = {
        contractAddress: cm.address,
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 8,
        balanceWeiReceiver: 2,
        balanceTokenSender: 4,
        balanceTokenReceiver: 6,
        txCount: 3
      };
      viewerSig = await getThreadSig(threadStateUpdated, viewer);
    });

    describe("happy paths", () => {
      it("succeeds when sender challenges thread", async () => {
        await challengeThread(threadStateUpdated, viewerSig, viewer);
        await happyAssertions(threadStateUpdated);
      });
      it("succeeds when reciever challenges thread", async () => {
        await challengeThread(threadStateUpdated, viewerSig, performer);
        await happyAssertions(threadStateUpdated);
      });
      it("succeeds when hub challenges thread", async () => {
        await challengeThread(threadStateUpdated, viewerSig, hub);
        await happyAssertions(threadStateUpdated);
      });
    });

    describe("edge cases", () => {
      it("succeeds if sender challenges twice in a row", async () => {});
    });

    describe("assertions", () => {
      it("fails if msg.sender is not either the sender, receiver or hub", async () => {});
      it("fails if now < the thread closing time (thread has already been settled)", async () => {});
      it("fails if now < the thread closing time (thread exit has not yet started)", async () => {});
      it("fails if the submitted txCount is not higher than current txCount", async () => {});
      it("fails if wei balances are not conserved", async () => {});
      it("fails if token balances are not conserved", async () => {});
      it("fails if either wei or token balances decrease", async () => {});
      it("fails if any _verifyThread req fails", async () => {});
      it("fails if sender's signature is incorrect (long test)", async () => {});
    });
  });

  describe("emptyThread", () => {
    let channelStateWithThreadsSender;
    let channelStateWithThreadsReceiver;
    let threadStateInitial;
    let threadStateUpdated;
    let proof;
    let viewerSig;

    // assert correct totalChannelWei and totalChannelTokens after thread is emptied
    // assert correct wei and token transfer if user == receiver
    // assert correct wei and token transfer if user == sender
    // assert correct thread.emptied, threadCount in success case
    // assert channel state correctly reinitialized if threadCount == 0
    const happyAssertions = async (threadState, emptier) => {
      const thread = await cm.getThread(threadState.sender, threadState.receiver, threadState.threadId);
      assert(thread.weiSender.eq(toBN(threadState.balanceWeiSender)));
      assert(thread.weiReceiver.eq(toBN(threadState.balanceWeiReceiver)));
      assert(thread.tokenSender.eq(toBN(threadState.balanceTokenSender)));
      assert(thread.tokenReceiver.eq(toBN(threadState.balanceTokenReceiver)));
      assert(thread.txCount.eq(toBN(threadState.txCount)));
      emptier === "sender" ? thread.emptiedSender.should.be.true : thread.emptiedSender.should.be.false;
      emptier === "receiver" ? thread.emptiedReceiver.should.be.true : thread.emptiedReceiver.should.be.false;
    };

    beforeEach(async () => {
      // initialize emptied channels on both sides of thread
      await token.transfer(cm.address, 1000, { from: hub.address });
      await web3.eth.sendTransaction({ from: hub.address, to: cm.address, value: 700 });

      threadStateInitial = {
        contractAddress: cm.address.toLowerCase(),
        sender: viewer.address,
        receiver: performer.address,
        threadId: 0,
        balanceWeiSender: 10,
        balanceWeiReceiver: 0,
        balanceTokenSender: 10,
        balanceTokenReceiver: 0,
        txCount: 0
      };
      threadStateInitial.sigA = await getThreadSig(threadStateInitial, viewer);

      // sender
      channelStateWithThreadsSender = await fastForwardToEmptiedChannel(state, threadStateInitial, viewer);
      let channelDetails = await cm.getChannelDetails(viewer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      // receiver
      await fastForwardToEmptiedChannel(channelStateReceiver, threadStateInitial, performer);
      channelDetails = await cm.getChannelDetails(performer.address);
      assert(channelDetails.status.eq(toBN(channelStatus.ThreadDispute)));

      proof = clientUtils.generateThreadProof(threadStateInitial, [threadStateInitial]);
      viewerSig = await getThreadSig(threadStateInitial, viewer);
      await startExitThread(channelStateWithThreadsSender, threadStateInitial, proof, viewerSig, viewer);

      await moveForwardSecs(challengePeriod + 1);
    });

    describe("happy paths", () => {
      it("succeeds if sender empties thread then reciever", async () => {
        let channelDetails = await cm.getChannelDetails(viewer.address);
        for (const [key, val] of Object.entries(channelDetails)) {
          if (typeof val !== 'string') {
            channelDetails[key] = val.toString();
          }
        }
        let channelBalances = await cm.getChannelBalances(viewer.address);
        for (const [key, val] of Object.entries(channelBalances)) {
          if (typeof val !== 'string') {
            channelBalances[key] = val.toString();
          }
        }
        await emptyThread(channelStateWithThreadsSender, threadStateInitial, proof, viewerSig, viewer);
        await happyAssertions(threadStateInitial, "sender");
      });
      it("succeeds if reciever empties thread then sender", async () => {
        happyAssertions();
      });
      it("succeeds if hub empties both sides of the thread", async () => {
        happyAssertions();
      });
    });

    describe("edge cases", () => {
      it("succeeds if sender empties & thread count goes to zero & sender deposits", async () => {});
    });

    describe("assertions", () => {
      it("fails if user's channel is not in thread dispute status", async () => {});
      it("fails if msg.sender is not the hub or user", async () => {});
      it("fails if the user is not sender or receiver", async () => {});
      it("fails if the initial receiver balances are not 0", async () => {});
      it("fails if the thread closing time has not passed (still in dispute)", async () => {});
      it("fails if the thread closing time is 0 (exit not started)", async () => {});
      it("fails if the user attempts to empty an already emptied thread", async () => {});
      it("fails if any _verifyThread req fails", async () => {});
      it("fails if wei balances are not equal to sender's initial balance", async () => {});
      it("fails if token balances are not equal to sender's initial balance", async () => {});
      it("fails if token transfer fails", async () => {
        /* Might not be possible to hit this one */
      });
      it("fails if sender's signature is incorrect (long test)", async () => {});
    });
  });

  describe("nukeThreads", () => {
    const happyAssertions = () => {
      // assert it correctly reduces totalChannelWei and totalChannelToken
      // assert it correctly reinitializes channel params
      return true;
    };

    beforeEach(async () => {
      /* Setup test env */
    });

    describe("happy paths", () => {
      it("succeeds if user nukes threads", async () => {
        happyAssertions();
      });
      it("succeeds if hub nukes threads and then deposits", async () => {
        happyAssertions();
      });
    });

    describe("edge cases", () => {});

    describe("assertions", () => {
      it("fails if user is hub", async () => {});
      it("fails if user is channelManager", async () => {});
      it("fails if channel does not have thead dispute status", async () => {});
      it("fails if closing time + 10x challenge periods habe not elapsed yet", async () => {});
      it("fails if token transfer fails", async () => {
        /* Might not be possible to hit this one */
      });
    });
  });
});
