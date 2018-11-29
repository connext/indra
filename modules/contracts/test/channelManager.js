"use strict";
console.log(__dirname)
const Utils = require("./helpers/utils");
const Ledger = artifacts.require("./ChannelManager.sol");
const EC = artifacts.require("./ECTools.sol");
const Token = artifacts.require("./lib/HumanStandardToken.sol");
const Connext = require("connext");
const privKeys = require("./privKeys.json")


const should = require("chai")
  .use(require("chai-as-promised"))
  .should();

const SolRevert = "VM Exception while processing transaction: revert";

const emptyRootHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function wait(ms) {
  const start = Date.now();
  console.log(`Waiting for ${ms}ms...`);
  while (Date.now() < start + ms) { }
  return true;
}

function generateProof(vcHashToProve, vcInitStates) {
  const merkle = Connext.generateMerkleTree(vcInitStates);
  const mproof = merkle.proof(Utils.hexToBuffer(vcHashToProve));

  let proof = [];
  for (var i = 0; i < mproof.length; i++) {
    proof.push(Utils.bufferToHex(mproof[i]));
  }

  proof.unshift(vcHashToProve);

  proof = Utils.marshallState(proof);
  return proof;
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

async function initHash(contract, init, accountIndex) {
  const hash = await web3.utils.soliditySha3(
    contract.address,
    { type: 'address[2]', value: [init.user, init.recipient] },
    { type: 'uint256[2]', value: init.weiBalances },
    { type: 'uint256[2]', value: init.tokenBalances },
    { type: 'uint256[4]', value: init.pendingWeiUpdates },
    { type: 'uint256[4]', value: init.pendingTokenUpdates },
    { type: 'uint256[2]', value: init.txCount },
    { type: 'bytes32', value: init.threadRoot },
    init.threadCount,
    init.timeout
  )
  const sig = await web3.eth.accounts.sign(hash, privKeys[accountIndex])
  return sig.signature
}

// NOTE : ganache-cli -m 'refuse result toy bunker royal small story exhaust know piano base stand'

contract("ChannelManager::constructor", accounts => {
  let channelManager, tokenAddress, hubAddress, challengePeriod, approvedToken

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
    tokenAddress = await Token.deployed()
    hubAddress = await channelManager.hub()
    challengePeriod = await channelManager.challengePeriod()
    approvedToken = await channelManager.approvedToken()
  })

  describe('contract deployment', () => {
    it("verify initialized parameters", async () => {
      assert.equal(hubAddress, accounts[0])
      assert.equal(challengePeriod.toNumber(), 10000)
      assert.equal(approvedToken, tokenAddress.address)
    })
  })
})

contract("ChannelManager::hubContractWithdraw", accounts => {
  let channelManager

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('hubContractWithdraw', () => {
    it("happy case", async () => {
      await channelManager.hubContractWithdraw(
        0,
        0
      )
    })
  })
});

contract("ChannelManager::hubAuthorizedUpdate", accounts => {
  let channelManager

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('hubAuthorizedUpdate', () => {
    let init

    beforeEach(async () => {
      init = {
        "user": accounts[1],
        "recipient": accounts[1],
        "weiBalances": [0, 0],
        "tokenBalances": [0, 0],
        "pendingWeiUpdates": [0, 0, 0, 0],
        "pendingTokenUpdates": [0, 0, 0, 0],
        "txCount": [1, 1],
        "threadRoot": emptyRootHash,
        "threadCount": 0,
        "timeout": 0
      }
    })

    it("happy case", async () => {
      init.sigUser = await initHash(channelManager, init, 1)
      await channelManager.hubAuthorizedUpdate(
        init.user,
        init.recipient,
        init.weiBalances,
        init.tokenBalances,
        init.pendingWeiUpdates,
        init.pendingTokenUpdates,
        init.txCount,
        init.threadRoot,
        init.threadCount,
        init.timeout,
        init.sigUser
      )
    })
  })
});


contract("ChannelManager::userAuthorizedUpdate", accounts => {
  let channelManager

  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('userAuthorizedUpdate', () => {
    let hash, init
    beforeEach(async () => {
      init = {
        "user": accounts[1],
        "recipient": accounts[1],
        "weiBalances": [0, 0],
        "tokenBalances": [0, 0],
        "pendingWeiUpdates": [0, 0, 0, 0],
        "pendingTokenUpdates": [0, 0, 0, 0],
        "txCount": [1, 1],
        "threadRoot": emptyRootHash,
        "threadCount": 0,
        "timeout": 0
      }
    })

    it("happy case", async () => {
      init.sigHub = await initHash(channelManager, init, 0)
      await channelManager.userAuthorizedUpdate(
        init.recipient,
        init.weiBalances,
        init.tokenBalances,
        init.pendingWeiUpdates,
        init.pendingTokenUpdates,
        init.txCount,
        init.threadRoot,
        init.threadCount,
        init.timeout,
        init.sigHub,
        { from: accounts[1] }
      )
    })
  })
});


contract("ChannelManager::startExit", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExit', () => {
    it("happy case", async () => {
      await channelManager.startExit(
        accounts[0]
      )
    })
  })
});


contract("ChannelManager::startExitWithUpdate", accounts => {
  let channelManager, init
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  beforeEach(async () => {
    init = {
      "user": [accounts[1], accounts[2]],
      "weiBalances": [0, 0],
      "tokenBalances": [0, 0],
      "pendingWeiUpdates": [0, 0, 0, 0],
      "pendingTokenUpdates": [0, 0, 0, 0],
      "txCount": [1, 1],
      "threadRoot": emptyRootHash,
      "threadCount": 0,
      "timeout": 0
    }
  })

  describe('startExitWithUpdate', () => {
    it("happy case", async () => {
      const hash = await web3.utils.soliditySha3(
        channelManager.address,
        { type: 'address[2]', value: init.user },
        { type: 'uint256[2]', value: init.weiBalances },
        { type: 'uint256[2]', value: init.tokenBalances },
        { type: 'uint256[4]', value: init.pendingWeiUpdates },
        { type: 'uint256[4]', value: init.pendingTokenUpdates },
        { type: 'uint256[2]', value: init.txCount },
        { type: 'bytes32', value: init.threadRoot },
        init.threadCount,
        init.timeout
      )
      const signatureHub = await web3.eth.accounts.sign(hash, privKeys[0])
      const signatureUser = await web3.eth.accounts.sign(hash, privKeys[1])

      init.sigHub = signatureHub.signature
      init.sigUser = signatureUser.signature

      await channelManager.startExitWithUpdate(
        init.user,
        init.weiBalances,
        init.tokenBalances,
        init.pendingWeiUpdates,
        init.pendingTokenUpdates,
        init.txCount,
        init.threadRoot,
        init.threadCount,
        init.timeout,
        init.sigHub,
        init.sigUser
      )
    })
  })
});
/*

// TODO
contract("ChannelManager::emptyChannelWithChallenge", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('emptyChannelWithChallenge', () => {
    it("happy case", async() => {
      await channelManager.emptyChannelWithChallenge(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::emptyChannel", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('emptyChannel', () => {
    it("happy case", async() => {
      await channelManager.emptyChannel(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::startExitThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExitThread', () => {
    it("happy case", async() => {
      await channelManager.startExitThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::startExitThreadWithUpdate", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('startExitThreadWithUpdate', () => {
    it("happy case", async() => {
      await channelManager.startExitThreadWithUpdate(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::fastEmptyThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('fastEmptyThread', () => {
    it("happy case", async() => {
      await channelManager.fastEmptyThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::emptyThread", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('emptyThread', () => {
    it("happy case", async() => {
      await channelManager.emptyThread(
        accounts[0]
      )
    })
  })
});

// TODO
contract("ChannelManager::nukeThreads", accounts => {
  let channelManager
  before('deploy contracts', async () => {
    channelManager = await Ledger.deployed()
  })

  describe('nukeThreads', () => {
    it("happy case", async() => {
      await channelManager.nukeThreads(
        accounts[0]
      )
    })
  })
});

*/
