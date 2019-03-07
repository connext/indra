// 'use strict'

// import MerkleTree from '../helpers/MerkleTree'
// const Utils = require('../helpers/utils')
// const Ledger = artifacts.require('./LedgerChannel.sol')
// const EC = artifacts.require('./ECTools.sol')

// const Web3latest = require('web3')
// const web3latest = new Web3latest(new Web3latest.providers.HttpProvider("http://localhost:8545")) //ganache port

// let lc

// // state

// let partyA
// let partyB
// let partyI

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
// let AB_vc1
// let AB_vc2

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

// contract('Test Alice Disputed VC Payments', function(accounts) {

//   before(async () => {
//     partyA = accounts[0]
//     partyB = accounts[1]
//     partyI = accounts[2]

//     let ec = await EC.new()
//     Ledger.link('ECTools', ec.address)
//     lc = await Ledger.new()
//   })

//   it("Create initial ledger channel state lcS0 for AI channel", async () => {
//     AI_lcS0 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '0' }, // sequence
//       { type: 'uint256', value: '0' }, // open VCs
//       { type: 'bytes32', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('10') },
//       { type: 'uint256', value: web3latest.utils.toWei('20') }
//     ) 
//   })

//   it("Alice signs initial lcS0 state", async () => {
//     AI_lcS0_sigA = await web3latest.eth.sign(AI_lcS0, partyA)
//   })


//   it("Alice initiates ledger channel with lcS0", async () => {
//     let res = await lc.createChannel(web3latest.utils.sha3('0000', {encoding: 'hex'}), partyI, Utils.duration.seconds(10), {from:partyA, value: web3latest.utils.toWei('10')})
//     //time = res.logs[0].args.time

//   })

//   it("Alice can exit openChannel before hub joins", async () => {
//     await Utils.expectThrow(lc.LCOpenTimeout(web3latest.utils.sha3('0000', {encoding: 'hex'})))
//     await Utils.increaseTime(Utils.duration.seconds(10))
//     let res = await lc.LCOpenTimeout(web3latest.utils.sha3('0000', {encoding: 'hex'}))
//     console.log(res.logs[0].args)
//   })

//   it("Alice initiates ledger channel with same id", async () => {
//     await lc.createChannel(web3latest.utils.sha3('1111', {encoding: 'hex'}), partyI, '0', {from:partyA, value: web3latest.utils.toWei('10')})
//   })

//   it("Hub signs initial lcS0 state", async () => {
//     AI_lcS0_sigI = await web3latest.eth.sign(AI_lcS0, partyI)
//   })

//   it("Ingrid joins ledger channel", async () => {
//     await lc.joinChannel(web3latest.utils.sha3('1111', {encoding: 'hex'}), {from: partyI, value: web3latest.utils.toWei('20')})
//   })

//   // Bob creates ledger channel
//   it("Create Bob's ledger channel state lcS0 for BI channel", async () => {
//     BI_lcS0 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '0' }, // sequence
//       { type: 'uint256', value: '0' }, // open VCs
//       { type: 'bytes32', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyB }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('10') },
//       { type: 'uint256', value: web3latest.utils.toWei('20') }
//     ) 
//   })

//   it("Bob signs initial lcS0 state", async () => {
//     BI_lcS0_sigB = await web3latest.eth.sign(BI_lcS0, partyB)
//   })


//   it("Bob initiates ledger channel with lcS0", async () => {
//     await lc.createChannel(web3latest.utils.sha3('2222', {encoding: 'hex'}), partyI, '0', {from:partyB, value: web3latest.utils.toWei('10')})
//   })

//   it("Hub signs initial lcS0 state", async () => {
//     BI_lcS0_sigI = await web3latest.eth.sign(BI_lcS0, partyI)
//   })

//   it("Ingrid joins ledger channel", async () => {
//     await lc.joinChannel(web3latest.utils.sha3('2222', {encoding: 'hex'}), {from: partyI, value: web3latest.utils.toWei('20')})
//   })


//   it("Alice creates vc state vcSO with Bob", async () => {
//     AB_vcS0 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('1337', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: '0' }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // counterparty
//       { type: 'uint256', value: web3latest.utils.toWei('12') }, // hub bond
//       { type: 'uint256', value: web3latest.utils.toWei('3') },
//       { type: 'uint256', value: web3latest.utils.toWei('9') }
//     )

//   })

//   it("Alice signs vcSO", async () => {
//     AB_vcS0_sigA = await web3latest.eth.sign(AB_vcS0, partyA)
//   })

//   it("Alice creates lc state lcS1 containing vcSO with Ingrid", async () => {
//     var buf = Utils.hexToBuffer(AB_vcS0)
//     var elems = []
//     elems.push(buf)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))
//     assert.equal(elems.length, 2)

//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     AI_lcS1 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '1' }, // sequence
//       { type: 'uint256', value: '1' }, // open VCs
//       { type: 'bytes32', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('5') },
//       { type: 'uint256', value: web3latest.utils.toWei('13') }
//     ) 
//   })

//   it("Alice signs lcS1 state and sends to Hub", async () => {
//     AI_lcS1_sigA = await web3latest.eth.sign(AI_lcS1, partyA)
//   })

//   it("Bob creates lc state lcS1 containing vcSO with Ingrid", async () => {
//     var buf = Utils.hexToBuffer(AB_vcS0)
//     var elems = []
//     elems.push(buf)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))

//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     BI_lcS1 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '1' }, // sequence
//       { type: 'uint256', value: '1' }, // open VCs
//       { type: 'bytes32', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyB }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('3') },
//       { type: 'uint256', value: web3latest.utils.toWei('15') }
//     ) 
//   })

//   it("Bob signs lcS1 state and sends to hub", async () => {
//     BI_lcS1_sigB = await web3latest.eth.sign(BI_lcS1, partyB)
//   })

//   it("Hub signs both Alice and Bob's lcS1 state to open VC", async () => {
//     AI_lcS1_sigI = await web3latest.eth.sign(AI_lcS1, partyI)
//     BI_lcS1_sigI = await web3latest.eth.sign(BI_lcS1, partyI)
//   })

//   it("Assign Bob multiple vc", async () => {
//     AB_vc1 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('random', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: '0' }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // counterparty
//       { type: 'uint256', value: web3latest.utils.toWei('1') }, // hub bond
//       { type: 'uint256', value: web3latest.utils.toWei('2') },
//       { type: 'uint256', value: web3latest.utils.toWei('3') }
//     )

//     AB_vc2 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('random2', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: '0' }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // counterparty
//       { type: 'uint256', value: web3latest.utils.toWei('4') }, // hub bond
//       { type: 'uint256', value: web3latest.utils.toWei('5') },
//       { type: 'uint256', value: web3latest.utils.toWei('6') }
//     )

//     var buf = Utils.hexToBuffer(AB_vc1)
//     var buf1 = Utils.hexToBuffer(AB_vc2)
//     var buf2 = Utils.hexToBuffer(AB_vcS0)
//     var elems = []
//     elems.push(buf)
//     elems.push(buf1)
//     elems.push(buf2)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))

//     var merkle = new MerkleTree(elems)

//     vcRootHash = Utils.bufferToHex(merkle.getRoot())

//     BI_lcS2 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc4', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '2' }, // sequence
//       { type: 'uint256', value: '3' }, // open VCs
//       { type: 'bytes32', value: vcRootHash }, // VC root hash
//       { type: 'address', value: partyB }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('3') },
//       { type: 'uint256', value: web3latest.utils.toWei('15') }
//     ) 
//   })

//   it("Bob/Hub signs lcS2 state", async () => {
//     BI_lcS2_sigB = await web3latest.eth.sign(BI_lcS2, partyB)
//     BI_lcS2_sigI = await web3latest.eth.sign(BI_lcS2, partyI)
//   })

//   it("Alice generates virtual channel payment with Bob", async () => {   
//     AB_vcS1 = web3latest.utils.soliditySha3(
//       { type: 'bytes32', value: web3latest.utils.sha3('1337', {encoding: 'hex'}) }, // vc id
//       { type: 'uint256', value: '1' }, // sequence
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyB }, // counterparty
//       { type: 'uint256', value: web3latest.utils.toWei('12') }, // hub bond
//       { type: 'uint256', value: web3latest.utils.toWei('2') },
//       { type: 'uint256', value: web3latest.utils.toWei('10') }
//     )

//   })

//   it("Alice signs vcS1", async () => {
//     AB_vcS1_sigA = await web3latest.eth.sign(AB_vcS1, partyA)
//   })

//   it("Alice generates lc state to close vc", async () => {
   

//     AI_lcS2 = web3latest.utils.soliditySha3(
//       { type: 'bool', value: false }, // isclose
//       //{ type: 'bytes32', value: web3.sha3('lc2', {encoding: 'hex'}) }, // lcid
//       { type: 'uint256', value: '2' }, // sequence
//       { type: 'uint256', value: '0' }, // open VCs
//       { type: 'bytes32', value: '0x0' }, // VC root hash
//       { type: 'address', value: partyA }, // partyA
//       { type: 'address', value: partyI }, // hub
//       { type: 'uint256', value: web3latest.utils.toWei('8') },
//       { type: 'uint256', value: web3latest.utils.toWei('22') }
//     ) 

//   })

//   // TODO: doesnt make sense to settle on single direction payment receiver
//   it("Ingrid initiates settling on-chain with byzantine Bob", async () => {
//     let res = await lc.updateLCstate(web3latest.utils.sha3('2222', {encoding: 'hex'}), ['2', '3', web3latest.utils.toWei('3'), web3latest.utils.toWei('15')], vcRootHash, BI_lcS2_sigB, BI_lcS2_sigI)
//     var gasUsed = res.receipt.gasUsed
//     //console.log('updateChan: '+ gasUsed)    
//     // let seq = await lc2.sequence()
//     // let numvc = await lc2.numOpenVC()
//     // let ba = await lc2.balanceA()
//     // let bi = await lc2.balanceI()
//     // let root = await lc2.VCrootHash()

//     // let isSettle = await lc2.isUpdateLCSettling()
//     // let timeout = await lc2.updateLCtimeout()
//   })

//   it("Ingrid initiates settling vc with initial state", async () => {
//     var buf = Utils.hexToBuffer(AB_vc1)
//     var buf1 = Utils.hexToBuffer(AB_vc2)
//     var buf2 = Utils.hexToBuffer(AB_vcS0)
//     var elems = []
//     elems.push(buf)
//     elems.push(buf1)
//     elems.push(buf2)
//     elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))

//     var merkle = new MerkleTree(elems)

//     let mproof = merkle.proof(buf2)

//     let proof = []
//     for(var i=0; i<mproof.length; i++){
//       proof.push(Utils.bufferToHex(mproof[i]))
//     }

//     proof.unshift(AB_vcS0)

//     proof = Utils.marshallState(proof)

//     // todo: generate vcID before vc creation and perhaps store in state
//     let res = await lc.initVCstate(web3latest.utils.sha3('2222', {encoding: 'hex'}), web3latest.utils.sha3('1337', {encoding: 'hex'}), proof, partyA, partyB, web3latest.utils.toWei('12'), web3latest.utils.toWei('3'), web3latest.utils.toWei('9'), AB_vcS0_sigA)
//     var gasUsed = res.receipt.gasUsed
//     //console.log('initialize VC: '+ gasUsed)
//   })

//   it("Igrid or a watcher supply latest known vc state vcS1", async () => {
//     let res = await lc.settleVC(web3latest.utils.sha3('2222', {encoding: 'hex'}), web3latest.utils.sha3('1337', {encoding: 'hex'}), '1', partyA, partyB, [web3latest.utils.toWei('2'), web3latest.utils.toWei('10')], AB_vcS1_sigA)
//     var gasUsed = res.receipt.gasUsed
//     //console.log('settle VC: '+ gasUsed)
//   })

//   it("Hub may now sign Alice's lcS2 state to consensus close VC", async () => {
//     AI_lcS2_sigI = await web3latest.eth.sign(AI_lcS2, partyI)
//   })

//   it("Anyone calls the wakeup function to settle vc state into lc state", async () => {
//     let res = await lc.closeVirtualChannel(web3latest.utils.sha3('2222', {encoding: 'hex'}), web3latest.utils.sha3('1337', {encoding: 'hex'}))
//     var gasUsed = res.receipt.gasUsed
//     //console.log('close VC: '+ gasUsed)
//   })

//   it("Ingrid initiates settling remaining open vc", async () => {
//     // var buf = Utils.hexToBuffer(AB_vc1)
//     // var buf1 = Utils.hexToBuffer(AB_vc2)
//     // var buf2 = Utils.hexToBuffer(AB_vcS0)
//     // var elems = []
//     // elems.push(buf)
//     // elems.push(buf1)
//     // elems.push(buf2)
//     // elems.push(Utils.hexToBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'))

//     // var merkle = new MerkleTree(elems)

//     // let mproof = merkle.proof(buf1)

//     // let proof = []
//     // for(var i=0; i<mproof.length; i++){
//     //   proof.push(Utils.bufferToHex(mproof[i]))
//     // }

//     // proof.unshift(AB_vc2)

//     // proof = Utils.marshallState(proof)

//     // // todo: generate vcID before vc creation and perhaps store in state
//     // let res = await lc.initVCstate(web3latest.utils.sha3('2222', {encoding: 'hex'}), web3latest.utils.sha3('1337', {encoding: 'hex'}), proof, '0', partyA, partyB, web3latest.utils.toWei('4'), web3latest.utils.toWei('5'), web3latest.utils.toWei('6'), AB_vcS1_sigA)
//     // var gasUsed = res.receipt.gasUsed
//     // console.log('initialize VC: '+ gasUsed)
//   })

//   it("Anyone calls close byzantine channel since all vc are closed", async () => {
//     // var balA = await web3latest.eth.getBalance(partyA)
//     // var balB = await web3latest.eth.getBalance(partyI)
//     // console.log('Balance A before close: ' + balA)
//     // console.log('Balance I before close: ' + balB)
//     // let res = await lc.byzantineCloseChannel(web3latest.utils.sha3('2222', {encoding: 'hex'}))
//     // var gasUsed = res.receipt.gasUsed
//     // console.log('bclose LC: '+ gasUsed)
//     // balA = await web3latest.eth.getBalance(partyA)
//     // balB = await web3latest.eth.getBalance(partyI)
//     // console.log('Balance A after close: ' + balA)
//     // console.log('Balance I after close: ' + balB)
//   })


// })