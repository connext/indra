// 'use strict'

// import MerkleTree from '../helpers/MerkleTree'
// const Utils = require('../helpers/utils')
// const Ledger = artifacts.require('./LedgerChannel.sol')
// const EC = artifacts.require('./ECTools.sol')
// const Token = artifacts.require('./token/HumanStandardToken.sol')

// const Web3latest = require('web3')
// const web3latest = new Web3latest(new Web3latest.providers.HttpProvider("http://localhost:8545")) //ganache port


// let lc
// let token

// // state

// let partyA
// let partyB
// let partyI

// let lcid_AI
// let lcid_BI

// let vcRootHash

// // is close flag, lc state sequence, number open vc, vc root hash, partyA/B, partyI, balA/B, balI

// let AI_lcS0
// let AI_lcS1
// let AI_lcS2
// let AI_lcS3

// let BI_lcS0
// let BI_lcS1
// let BI_lcS2

// let AB_vcS0
// let AB_vcS1

// let AB_vc2_S0
// let AB_vc2_S1

// // signature storage
// let AI_lcS0_sigA
// let AI_lcS1_sigA
// let AI_lcS2_sigA
// let AI_lcS3_sigA

// let AI_lcS0_sigI
// let AI_lcS1_sigI
// let AI_lcS2_sigI
// let AI_lcS3_sigI

// let BI_lcS0_sigB
// let BI_lcS1_sigB
// let BI_lcS2_sigB

// let BI_lcS0_sigI
// let BI_lcS1_sigI
// let BI_lcS2_sigI

// let AB_vcS0_sigA
// let AB_vcS1_sigA

// let AB_vcS0_sigB
// let AB_vcS1_sigB

// contract('Test Cooperative Token Payments', function(accounts) {

//   before(async () => {
//     partyA = accounts[0]
//     partyB = accounts[1]
//     partyI = accounts[2]

//     let ec = await EC.new()
//     token = await Token.new(1000, 'Test', 1, 'TST')
//     Ledger.link('HumanStandardToken', token.address)
//     Ledger.link('ECTools', ec.address)
//     lc = await Ledger.new()
//     await token.transfer(partyB, 100)
//     await token.transfer(partyI, 100)
//   })

//   it("Create initial ledger channel state lcS0 for AI channel", async () => {
//     lcid_AI = web3latest.utils.sha3('1111', {encoding: 'hex'})
//     AI_lcS0 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_AI }, // ID
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 0 }, // sequence
//       { type: 'uint256', value: 0 }, // open VCs
//       { type: 'string', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('0') }, // eth
//       { type: 'uint256', value: web3latest.utils.toWei('0') }, // eth
//       { type: 'uint256', value: web3latest.utils.toWei('20') }, // token
//       { type: 'uint256', value: web3latest.utils.toWei('0') }  // token
//     ) 
//   })

//   it("Alice signs initial lcS0 state", async () => {
//     AI_lcS0_sigA = await web3latest.eth.sign(AI_lcS0, partyA)
//   })

//         // address[2] partyAdresses; // 0: partyA 1: partyI
//         // uint256[2] ethBalances; // 0: balanceA 1:balanceI
//         // uint256[2] erc20Balances; // 0: balanceA 1:balanceI
//         // uint256[2] deposited;
//         // uint256 initialDeposit;
//         // uint256 sequence;
//         // uint256 confirmTime;
//         // bytes32 VCrootHash;
//         // uint256 LCopenTimeout;
//         // uint256 updateLCtimeout; // when update LC times out
//         // bool isOpen; // true when both parties have joined
//         // bool isUpdateLCSettling;
//         // uint256 numOpenVC;


//   it("Alice initiates ledger channel with lcS0", async () => {
//     let approval = await token.approve(lc.address, 10)
//     let res = await lc.createChannel(lcid_AI, partyI, '0', token.address, [0, 10])
//     var gasUsed = res.receipt.gasUsed
//     //console.log('createChan: '+ gasUsed)
//     let openChans = await lc.numChannels()
//     let chan = await lc.getChannel(lcid_AI)
//     assert.equal(chan[0].toString(), [partyA,partyI]) //check partyAddresses
//     assert.equal(chan[1].toString(), ['0', '0', '0', '0']) //check ethBalances
//     assert.equal(chan[2].toString(), ['10', '0', '0', '0']) //check erc20Balances
//     assert.equal(chan[3].toString(), [0,'10']) //check initalDeposit
//     assert.equal(chan[4].toString(), '0') //check sequence
//     assert.equal(chan[5].toString(), '0') //check confirmTime
//     assert.equal(chan[6], '0x0000000000000000000000000000000000000000000000000000000000000000') //check VCrootHash
//     //check if chan[7] is equal to now + confirmtime
//     assert.equal(chan[8].toString(), '0') //check updateLCTimeout
//     assert.equal(chan[9], false) //check isOpen
//     assert.equal(chan[10], false) //check isUpdateLCSettling
//     assert.equal(chan[11], '0') //check numOpenVC
//   })

//   it("Hub signs initial lcS0 state", async () => {
//     AI_lcS0_sigI = await web3latest.eth.sign(AI_lcS0, partyI)
//   })

//   it("Ingrid joins ledger channel", async () => {
//     let approval = await token.approve(lc.address, 20, {from: partyI})
//     let res = await lc.joinChannel(lcid_AI, [0,20], {from: partyI})
//     var gasUsed = res.receipt.gasUsed
//     //console.log('joinChan: '+ gasUsed)
//     let openChans = await lc.numChannels()
//     let chan = await lc.getChannel(lcid_AI)
//     assert.equal(chan[0].toString(), [partyA,partyI]) //check partyAddresses
//     assert.equal(chan[1].toString(), ['0', '0', '0', '0']) //check ethBalances
//     assert.equal(chan[2].toString(), ['10', '20', '0', '0']) //check erc20Balances
//     assert.equal(chan[3].toString(), [0,'30']) //check initalDeposit
//     assert.equal(chan[4].toString(), '0') //check sequence
//     assert.equal(chan[5].toString(), '0') //check confirmTime
//     assert.equal(chan[6], '0x0000000000000000000000000000000000000000000000000000000000000000') //check VCrootHash
//     //check if chan[7] is equal to now + confirmtime
//     assert.equal(chan[8].toString(), '0') //check updateLCTimeout
//     assert.equal(chan[9], true) //check isOpen
//     assert.equal(chan[10], false) //check isUpdateLCSettling
//     assert.equal(chan[11], '0') //check numOpenVC
//   })

//   // Bob creates ledger channel
//   it("Create Bob's ledger channel state lcS0 for BI channel", async () => {
//     lcid_BI = web3latest.utils.sha3('2222', {encoding: 'hex'})

//     BI_lcS0 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_BI }, // ID
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 0 }, // sequence
//       { type: 'uint256', value: 0 }, // open VCs
//       { type: 'string', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyB }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('10') },
//       { type: 'uint256', value: web3latest.utils.toWei('20') },
//       { type: 'uint256', value: web3latest.utils.toWei('0') }, // token
//       { type: 'uint256', value: web3latest.utils.toWei('0') }  // token
//     ) 
//   })

//   it("Bob signs initial lcS0 state", async () => {
//     BI_lcS0_sigB = await web3latest.eth.sign(BI_lcS0, partyB)
//   })


//   it("Bob initiates ledger channel with lcS0", async () => {
//     let approval = await token.approve(lc.address, 10, {from: partyB})
//     let res = await lc.createChannel(lcid_BI, partyI, '0', token.address, [0,10], {from: partyB})
//     var gasUsed = res.receipt.gasUsed
//     //console.log('createChan: '+ gasUsed)
//     let openChans = await lc.numChannels()
//     let chan = await lc.getChannel(lcid_BI)
//     assert.equal(chan[0].toString(), [partyB,partyI]) //check partyAddresses
//     assert.equal(chan[1].toString(), ['0', '0', '0', '0']) //check ethBalances
//     assert.equal(chan[2].toString(), ['10', '0', '0', '0']) //check erc20Balances
//     assert.equal(chan[3].toString(), [0,'10']) //check initalDeposit
//     assert.equal(chan[4].toString(), '0') //check sequence
//     assert.equal(chan[5].toString(), '0') //check confirmTime
//     assert.equal(chan[6], '0x0000000000000000000000000000000000000000000000000000000000000000') //check VCrootHash
//     //check if chan[7] is equal to now + confirmtime
//     assert.equal(chan[8].toString(), '0') //check updateLCTimeout
//     assert.equal(chan[9], false) //check isOpen
//     assert.equal(chan[10], false) //check isUpdateLCSettling
//     assert.equal(chan[11], '0') //check numOpenVC
//   })

//   it("Hub signs initial lcS0 state", async () => {
//     BI_lcS0_sigI = await web3latest.eth.sign(BI_lcS0, partyI)
//   })

//   it("Ingrid joins ledger channel", async () => {
//     let approval = await token.approve(lc.address, 20, {from: partyI})
//     let res = await lc.joinChannel(lcid_BI, [0,20], {from: partyI})
//     var gasUsed = res.receipt.gasUsed
//     //console.log('joinChan: '+ gasUsed)
//     let openChans = await lc.numChannels()
//     let chan = await lc.getChannel(lcid_BI)
//     assert.equal(chan[0].toString(), [partyB,partyI]) //check partyAddresses
//     assert.equal(chan[1].toString(), ['0', '0', '0', '0']) //check ethBalances
//     assert.equal(chan[2].toString(), ['10', '20', '0', '0']) //check erc20Balances
//     assert.equal(chan[3].toString(), [0,'30']) //check initalDeposit
//     assert.equal(chan[4].toString(), '0') //check sequence
//     assert.equal(chan[5].toString(), '0') //check confirmTime
//     assert.equal(chan[6], '0x0000000000000000000000000000000000000000000000000000000000000000') //check VCrootHash
//     //check if chan[7] is equal to now + confirmtime
//     assert.equal(chan[8].toString(), '0') //check updateLCTimeout
//     assert.equal(chan[9], true) //check isOpen
//     assert.equal(chan[10], false) //check isUpdateLCSettling
//     assert.equal(chan[11], '0') //check numOpenVC
//   })


//   it("Alice creates vc state vcSO with Bob", async () => {
//     AB_vcS0 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('1337', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: 0 }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // partyB,
//       { type: 'uint256', value: 0 }, //hub eth bond
//       { type: 'uint256', value: 12 }, // hub token bond
//       { type: 'uint256', value: 0 },
//       { type: 'uint256', value: 0 },
//       { type: 'uint256', value: 5 }, // token
//       { type: 'uint256', value: 7 }  // token
//     )

//   })

//   it("Alice and Bob sign vcSO", async () => {
//     AB_vcS0_sigA = await web3latest.eth.sign(AB_vcS0, partyA)
//     AB_vcS0_sigB = await web3latest.eth.sign(AB_vcS0, partyB)
//   })

//   it("Alice creates lc state lcS1 containing vcSO with Ingrid", async () => {
//     var hash = web3latest.utils.sha3(AB_vcS0, {encoding: 'hex'})
//     var buf = Utils.hexToBuffer(hash)
//     var elems = []
//     elems.push(buf)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))
//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     AI_lcS1 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_AI },
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 1 }, // sequence
//       { type: 'uint256', value: 1 }, // open VCs
//       { type: 'string', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 5 }, // token
//       { type: 'uint256', value: 13 }  // token
//     ) 
//   })

//   it("Alice signs lcS1 state and sends to Hub", async () => {
//     AI_lcS1_sigA = await web3latest.eth.sign(AI_lcS1, partyA)
//   })

//   it("Bob creates lc state lcS1 containing vcSO with Ingrid", async () => {
//     var hash = web3latest.utils.sha3(AB_vcS0, {encoding: 'hex'})
//     var buf = Utils.hexToBuffer(hash)
//     var elems = []
//     elems.push(buf)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))
//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     BI_lcS1 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_BI },
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 1 }, // sequence
//       { type: 'uint256', value: 1 }, // open VCs
//       { type: 'string', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyB }, // partyB
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 3 }, // token
//       { type: 'uint256', value: 15 }  // token
//     ) 
//   })

//   it("Bob signs lcS1 state and sends to hub", async () => {
//     BI_lcS1_sigB = await web3latest.eth.sign(BI_lcS1, partyB)
//   })

//   it("Hub signs both Alice and Bob's lcS1 state to open VC", async () => {
//     AI_lcS1_sigI = await web3latest.eth.sign(AI_lcS1, partyI)
//     BI_lcS1_sigI = await web3latest.eth.sign(BI_lcS1, partyI)
//   })

//   it("Alice generates virtual channel payment with Bob (vcS1)", async () => {
//     AB_vcS1 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('1337', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: 1 }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // partyB
//       { type: 'uint256', value: 0 }, // hub eth bond
//       { type: 'uint256', value: 12}, //hub token bond
//       { type: 'uint256', value: 0 },
//       { type: 'uint256', value: 0 },
//       { type: 'uint256', value: 0 }, // token
//       { type: 'uint256', value: 12 }  // token
//     )

//   })

//   it("Alice and Bob sign vcS1", async () => {
//     AB_vcS1_sigA = await web3latest.eth.sign(AB_vcS1, partyA)
//     AB_vcS1_sigB = await web3latest.eth.sign(AB_vcS1, partyB)
//   })

//   it("Alice generates lc state to close vc", async () => {
//     AI_lcS2 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_AI },
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 2 }, // sequence
//       { type: 'uint256', value: 0 }, // open VCs
//       { type: 'string', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 5 }, // token
//       { type: 'uint256', value: 25 }  // token
//     ) 

//   })

//   it("Bob generates lc state to close vc", async () => {
//     BI_lcS2 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_BI },
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 2 }, // sequence
//       { type: 'uint256', value: 0 }, // open VCs
//       { type: 'string', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyB }, // partyB
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 15 }, // token
//       { type: 'uint256', value: 15 }  // token
//     )   
//   })

//   it("Alice signs lcS2 state and sends to Hub", async () => {
//     AI_lcS2_sigA = await web3latest.eth.sign(AI_lcS2, partyA)
//   })

//   it("Bob signs lcS2 state and sends to hub", async () => {
//     BI_lcS2_sigB = await web3latest.eth.sign(BI_lcS2, partyB)
//   })

//   it("Hub signs both Alice and Bob's lcS2 state to close VC", async () => {
//     AI_lcS2_sigI = await web3latest.eth.sign(AI_lcS2, partyI)
//     BI_lcS2_sigI = await web3latest.eth.sign(BI_lcS2, partyI)
//   })

//   it("Alice creates lc update to close vc", async () => {
//     AI_lcS3 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_AI },
//       { type: 'bool', value: true }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '3' }, // sequence
//       { type: 'uint256', value: '0' }, // open VCs
//       { type: 'bytes32', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 0 }, //eth
//       { type: 'uint256', value: 5 }, // token
//       { type: 'uint256', value: 25 }  // token
//     ) 
//   })

//   it("Alice signs lcS3 state and sends to Hub", async () => {
//     AI_lcS3_sigA = await web3latest.eth.sign(AI_lcS3, partyA)
//   })

//   it("Hub signs closing lcS3 state", async () => {
//     AI_lcS3_sigI = await web3latest.eth.sign(AI_lcS3, partyI)
//   })

//   it("Close Alice ledger channel", async () => {
//     var balA1 = await token.balanceOf(partyA)
//     var balI1 = await token.balanceOf(partyI)
//     let receipt = await lc.consensusCloseChannel(lcid_AI, '3', [0, 0, 5, 25], AI_lcS3_sigA, AI_lcS3_sigI)
//     var gasUsed = receipt.receipt.gasUsed
//     //console.log('Close Channel: ' + gasUsed)
//     var balA2 = await token.balanceOf(partyA)
//     var balI2 = await token.balanceOf(partyI)
//     // TODO calculate gas, this may very based on testrpc
//     assert.equal(balI2 - balI1, '25')
//     // assert.equal(balA2 - balA1, '7926958099999998000')
//   })

//   /******TO DO******/
//   it("Hub deposits into Bob's lc", async () => {
//     await lc.deposit(lcid_BI, partyI, web3latest.utils.toWei('10'), false, {from:partyI, value:web3latest.utils.toWei('10')})
//     let chan = await lc.getChannel(lcid_BI)
//   })

//   it("Hub creates lc state lcS2 containing new deposit", async () => {
//     var hash = web3latest.utils.sha3(AB_vcS0, {encoding: 'hex'})
//     var buf = Utils.hexToBuffer(hash)
//     var elems = []
//     elems.push(buf)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))
//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     BI_lcS1 = web3latest.utils.soliditySha3(
//       { type: 'uint256', value: lcid_BI },
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: 2 }, // sequence
//       { type: 'uint256', value: 1 }, // open VCs
//       { type: 'string', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyB }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('3') },
//       { type: 'uint256', value: web3latest.utils.toWei('25') },
//       { type: 'uint256', value: web3latest.utils.toWei('0') }, // token
//       { type: 'uint256', value: web3latest.utils.toWei('0') }  // token
//     ) 
//   })

// })
