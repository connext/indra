// require('dotenv').config()
// const Web3 = require('web3')
// const HttpProvider = require(`ethjs-provider-http`)
// import { expect } from 'chai'
// import { UnsignedChannelState, ThreadState, unsignedChannelStateToChannelState, Purchase } from './types'
// import { Utils } from './Utils'
// import { Validation } from './Validation'
// import * as t from './testing'

// const utils = new Utils()
// const validation = new Validation(utils)

// describe('validatePurchaseAmount', () => {
//   it('should work for purchase with channel and thread update', () => {
//     // prev state
//     // balanceWei: [10, 20] // 10 in thread
//     // balanceToken: [10, 20] // 10 in thread
//     const purchase: Purchase = {
//       purchaseId: 'purchaseId',
//       meta: {},
//       amount: {
//         wei: '10',
//         token: '10'
//       },
//       payments: [
//         {
//           recipient: t.mkAddress('0xR2'),
//           amount: {
//             wei: '1',
//             token: '1'
//           },
//           meta: {},
//           type: 'PT_CHANNEL',
//           update: {
//             reason: "Payment",
//             state: t.getChannelState("empty", {
//               balanceWei: ['9', '21'],
//               balanceToken: ['9', '21'],
//             }),
//             metadata: {},
//           }
//         },
//         {
//           recipient: t.mkAddress('0xT2'),
//           amount: {
//             wei: '9',
//             token: '9'
//           },
//           meta: {},
//           type: 'PT_THREAD',
//           update: {
//             reason: "Payment",
//             state: t.getThreadState("empty", {
//               balanceWei: ['1', '9'],
//               balanceToken: ['1', '9'],
//             }),
//             metadata: {},
//           }
//         },
//       ]
//     }

//     expect(validation.validatePurchaseAmount(purchase)).to.equal(
//       null,
//     )
//   })

//   it('should fail if the wei purchase amount provided is not the sum of the payment amounts', () => {
//     // prev state
//     // balanceWei: [10, 20] // 10 in thread
//     // balanceToken: [10, 20] // 10 in thread
//     const purchase: Purchase = {
//       purchaseId: 'purchaseId',
//       meta: {},
//       amount: {
//         wei: '20',
//         token: '10'
//       },
//       payments: [
//         {
//           recipient: t.mkAddress('0xR2'),
//           amount: {
//             wei: '1',
//             token: '1'
//           },
//           meta: {},
//           type: 'PT_CHANNEL',
//           update: {
//             reason: "Payment",
//             state: t.getChannelState("empty", {
//               balanceWei: ['9', '21'],
//               balanceToken: ['9', '21'],
//             }),
//             metadata: {},
//           }
//         },
//         {
//           recipient: t.mkAddress('0xT2'),
//           amount: {
//             wei: '9',
//             token: '9'
//           },
//           meta: {},
//           type: 'PT_THREAD',
//           update: {
//             reason: "Payment",
//             state: t.getThreadState("empty", {
//               balanceWei: ['1', '9'],
//               balanceToken: ['1', '9'],
//             }),
//             metadata: {},
//           }
//         },
//       ]
//     }

//     expect(validation.validatePurchaseAmount(purchase)).to.equal(
//       `Purchase wei amount does not equal sum of included wei payment amounts (payment total: ${JSON.stringify({ wei: '10', token: '10' })}, purchase: ${JSON.stringify(purchase)})`,
//     )
//   })

//   it('should fail if the token purchase amount provided is not the sum of the payment amounts', () => {
//     // prev state
//     // balanceWei: [10, 20] // 10 in thread
//     // balanceToken: [10, 20] // 10 in thread
//     const purchase: Purchase = {
//       purchaseId: 'purchaseId',
//       meta: {},
//       amount: {
//         wei: '10',
//         token: '20'
//       },
//       payments: [
//         {
//           recipient: t.mkAddress('0xR2'),
//           amount: {
//             wei: '1',
//             token: '1'
//           },
//           meta: {},
//           type: 'PT_CHANNEL',
//           update: {
//             reason: "Payment",
//             state: t.getChannelState("empty", {
//               balanceWei: ['9', '21'],
//               balanceToken: ['9', '21'],
//             }),
//             metadata: {},
//           }
//         },
//         {
//           recipient: t.mkAddress('0xT2'),
//           amount: {
//             wei: '9',
//             token: '9'
//           },
//           meta: {},
//           type: 'PT_THREAD',
//           update: {
//             reason: "Payment",
//             state: t.getThreadState("empty", {
//               balanceWei: ['1', '9'],
//               balanceToken: ['1', '9'],
//             }),
//             metadata: {},
//           }
//         },
//       ]
//     }

//     expect(validation.validatePurchaseAmount(purchase)).to.equal(
//       `Purchase token amount does not equal sum of included token payment amounts (payment total: ${JSON.stringify({ wei: '10', token: '10' })}, purchase: ${JSON.stringify(purchase)})`
//     )
//   })
// })

// describe('validateThreadStateUpdate', () => {
//   let web3
//   let accounts: any
//   let user: string, hubAddress: string, receiver: string
//   let previous: any
//   let current: any
//   beforeEach('instantiate web3', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     receiver = accounts[2]

//     previous = t.getThreadState('unsigned', {
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//       sender: user,
//       receiver,
//     })
//   })

//   it('should return null for a valid initial thread state', () => {
//     expect(
//       validation.validateThreadStateUpdate({
//         current: previous,
//         payment: { token: '5', wei: '5' },
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if initial state wei balance receiver is not 0', () => {
//     previous.balanceWeiReceiver = '5'
//     expect(
//       validation.validateThreadStateUpdate({
//         current: previous,
//         payment: { token: '5', wei: '5' },
//       }),
//     ).to.equal(
//       `Thread wei receiver balance is not 0 (thread: ${JSON.stringify(
//         previous,
//       )}`,
//     )
//   })

//   it('should fail if initial state token balance receiver is not 0', () => {
//     previous.balanceTokenReceiver = '5'
//     expect(
//       validation.validateThreadStateUpdate({
//         current: previous,
//         payment: { token: '5', wei: '5' },
//       }),
//     ).to.equal(
//       `Thread token receiver balance is not 0 (thread: ${JSON.stringify(
//         previous,
//       )}`,
//     )
//   })

//   it('should fail if initial state tx count is not 0', () => {
//     previous.txCount = 1
//     expect(
//       validation.validateThreadStateUpdate({
//         current: previous,
//         payment: { token: '5', wei: '5' },
//       }),
//     ).to.equal(
//       `Cannot open a thread with an initial nonce different than 0 (thread: ${JSON.stringify(
//         previous,
//       )}`,
//     )
//   })

//   it('should return null for a valid thread payment update', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment: { token: '1', wei: '1' },
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if the current sender changes', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: accounts[7],
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread sender cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the current sender changes', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: user,
//       receiver: accounts[7],
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread receiver cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the current sender changes', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: user,
//       receiver,
//       contractAddress: accounts[7],
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread contract address cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the transaction count does not increase by 1', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [4, 1],
//       txCount: 3,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread tx count must increase by 1 (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the update does not change receiver balance', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread updates must change receiver balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the update decreases receiver wei balance', () => {
//     previous = t.getThreadState('unsigned', {
//       balanceWei: [2, 3],
//       balanceToken: [2, 3],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     current = t.getThreadState('unsigned', {
//       balanceWei: [3, 2],
//       balanceToken: [3, 2],
//       txCount: 2,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread updates cannot decrease receiver wei balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the update decreases receiver token balance', () => {
//     previous = t.getThreadState('unsigned', {
//       balanceWei: [2, 3],
//       balanceToken: [2, 3],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     current = t.getThreadState('unsigned', {
//       balanceWei: [1, 4],
//       balanceToken: [3, 2],
//       txCount: 2,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread updates cannot decrease receiver token balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the thread receiver token balance is added incorrectly from payment', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [3, 2],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread receiver token balance incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the thread receiver wei balance is added incorrectly from payment', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [3, 2],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread receiver wei balance incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the thread sender token balance is added incorrectly from payment', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [4, 1],
//       balanceToken: [3, 1],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread sender token balance incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })

//   it('should fail if the thread sender wei balance is added incorrectly from payment', () => {
//     current = t.getThreadState('unsigned', {
//       balanceWei: [3, 1],
//       balanceToken: [4, 1],
//       txCount: 1,
//       sender: user,
//       receiver,
//     })
//     const payment = { token: '1', wei: '1' }
//     expect(
//       validation.validateThreadStateUpdate({
//         previous,
//         current,
//         payment,
//       }),
//     ).to.equal(
//       `Thread sender wei balance incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
//         payment,
//       )}`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::Payment', () => {
//   let web3: any
//   let accounts: string[]
//   let user: string
//   let hubAddress: string
//   let receiver: string
//   let previous: any
//   let current: UnsignedChannelState

//   beforeEach('instantiate web3, create signed accounts', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     receiver = accounts[2]

//     // set up states to have correct sigs and nonces
//     // generate previous state
//     previous = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//     })
//     // create hash
//     const hashPrev = validation.utils.createChannelStateHash(previous)
//     // sign
//     const sigUserPrev = await web3.eth.sign(hashPrev, user)
//     const sigHubPrev = await web3.eth.sign(hashPrev, hubAddress)
//     // add to state
//     previous.sigUser = sigUserPrev
//     previous.sigHub = sigHubPrev
//   })

//   it('should return null for valid wei and token payment update', async () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       txCountGlobal: previous.txCountGlobal + 1,
//       balanceWei: ['11', '9'],
//       balanceToken: ['9', '11'],
//       timeout: 0,
//     })
//     unsignedChannelStateToChannelState(current)
//     const payment = { wei: '1', token: '1' }
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         payment,
//         reason: 'Payment',
//       }),
//     ).to.equal(null)
//   })

//   it('should return null for valid wei payment update', async () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       txCountGlobal: previous.txCountGlobal + 1,
//       balanceWei: ['11', '9'],
//       balanceToken: ['10', '10'],
//       timeout: 0,
//     })
//     current = unsignedChannelStateToChannelState(current)
//     const payment = { wei: '1', token: '0' }
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         payment,
//         reason: 'Payment',
//       }),
//     ).to.equal(null)
//   })

//   it('should return null for valid token payment update', async () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       txCountGlobal: previous.txCountGlobal + 1,
//       balanceWei: ['10', '10'],
//       balanceToken: ['9', '11'],
//       timeout: 0,
//     })

//     const payment = { wei: '0', token: '1' }
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         payment,
//         reason: 'Payment',
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if channel wei balance is not conserved', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceToken: [10, 10],
//       balanceWei: [20, 10],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//       }),
//     ).to.equal(
//       `Cannot change total wei operating balance of the channel (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if channel token balance is not conserved', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [20, 10],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//       }),
//     ).to.equal(
//       `Cannot change total token operating balance of the channel (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if hub token balance is calculated incorrectly', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [12, 8],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     const payment = { token: '1', wei: '0' }
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//         payment,
//       }),
//     ).to.equal(
//       `Channel token balance incorrectly calculated (payment: ${JSON.stringify(
//         payment,
//       )},\n previous: ${JSON.stringify(previous)}, \n current: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if hub wei balance is calculated incorrectly', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     const payment = { token: '0', wei: '8' }
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//         payment,
//       }),
//     ).to.equal(
//       `Channel wei balance incorrectly calculated (payment: ${JSON.stringify(
//         payment,
//       )},\n previous: ${JSON.stringify(previous)}, \n current: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if user token balance is calculated incorrectly', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [8, 12],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     const payment = { token: '1', wei: '0' }
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//         payment,
//       }),
//     ).to.equal(
//       `Channel token balance incorrectly calculated (payment: ${JSON.stringify(
//         payment,
//       )},\n previous: ${JSON.stringify(previous)}, \n current: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if user wei balance is calculated incorrectly', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     const payment = { token: '0', wei: '8' }
//     // create hash
//     const hashCurr = validation.utils.createChannelStateHash(current)
//     // sign
//     const sigUserCurr = await web3.eth.sign(hashCurr, user)
//     const sigHubCurr = await web3.eth.sign(hashCurr, hubAddress)
//     // add to state
//     current.sigUser = sigUserCurr
//     current.sigHub = sigHubCurr
//     expect(
//       validation.validateChannelStateUpdate({
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         reason: 'Payment',
//         hubAddress,
//         payment,
//       }),
//     ).to.equal(
//       `Channel wei balance incorrectly calculated (payment: ${JSON.stringify(
//         payment,
//       )},\n previous: ${JSON.stringify(previous)}, \n current: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::ProposePending', () => {
//   let web3: any
//   let accounts: string[]
//   let user: string
//   let hubAddress: string
//   let receiver: string
//   let previous: any
//   let current: any

//   beforeEach('instantiate web3, create signed accounts', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     receiver = accounts[2]

//     // set up states to have correct sigs and nonces
//     // generate previous state
//     previous = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     // create hash
//     const hashPrev = validation.utils.createChannelStateHash(previous)
//     // sign
//     const sigUserPrev = await web3.eth.sign(hashPrev, user)
//     const sigHubPrev = await web3.eth.sign(hashPrev, hubAddress)
//     // add to state
//     previous.sigUser = sigUserPrev
//     previous.sigHub = sigHubPrev
//   })

//   it('should work for an initial user token deposit', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 0],
//       balanceToken: [0, 0],
//       pendingDepositToken: [0, 5],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       txCount: [1, 1],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: 0,
//     })
//     current = unsignedChannelStateToChannelState(current)
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for an initial user wei deposit', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 0],
//       balanceToken: [0, 0],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       txCount: [1, 1],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for an initial hub token deposit', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 0],
//       balanceToken: [0, 0],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       txCount: [1, 1],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for an initial hub wei deposit', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 0],
//       balanceToken: [0, 0],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [5, 0],
//       pendingWithdrawalWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       txCount: [1, 1],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for an initial hub + user wei + token deposit', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 0],
//       balanceToken: [0, 0],
//       pendingDepositToken: [5, 5],
//       pendingDepositWei: [5, 5],
//       pendingWithdrawalWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       txCount: [1, 1],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for user depositing tokens', () => {
//     // generate and sign state
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 5],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for user depositing wei', () => {
//     // generate and sign state
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub depositing tokens', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub depositing wei', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [5, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for both hub and user wei deposits', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [5, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for both hub and user token deposits', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 5],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for both hub and user depositing both token and wei', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 5],
//       pendingDepositWei: [5, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for user withdrawing tokens', () => {
//     // generate and sign state
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 5],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for user withdrawing wei', () => {
//     // generate and sign state
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for user withdrawing wei and tokens', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 5],
//       pendingWithdrawalWei: [0, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub withdrawing tokens', () => {
//     // generate and sign state
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [5, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub withdrawing wei', () => {
//     // generate and sign state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [5, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub withdrawing wei and tokens', () => {
//     // generate state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 10],
//       balanceToken: [5, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 0],
//       pendingWithdrawalWei: [5, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub and user withdrawing wei and tokens', () => {
//     // generate state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 5],
//       pendingWithdrawalWei: [5, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub depositing tokens and user withdrawing wei', () => {
//     // generate state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for hub depositing tokens, withdrawing wei, and user depositing wei', () => {
//     // generate state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [5, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if the user is depositing tokens and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 5],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `User pending deposit updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user is depositing wei and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `User pending deposit updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user is withdrawing wei and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `All pending withdrawal updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user is withdrawing tokens and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 5],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `All pending withdrawal updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub is withdrawing wei and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [5, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `All pending withdrawal updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub is withdrawing tokens and there is no timeout', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [5, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `All pending withdrawal updates must include timeouts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the chain transaction count is not increased by one', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Must increase chain nonce when proposing a pending operation (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user wei withdrawal is not decremented from channel balance', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Pending user wei withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user token withdrawal is not decremented from channel balance', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 5],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Pending user token withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub wei withdrawal is not decremented from channel balance', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [5, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Pending hub wei withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub token withdrawal is not decremented from channel balance', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Pending hub token withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub wei operating balance changes without withdrawals', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Channel hub wei balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user operating balance changes without withdrawals', () => {
//     // generate current channel state
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ProposePending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Channel user wei balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::ConfirmPending', () => {
//   let web3: any
//   let accounts: string[]
//   let user: string
//   let hubAddress: string
//   let previous: any
//   let current: UnsignedChannelState

//   beforeEach('instantiate web3, create signed accounts', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]

//     // set up states to have correct sigs and nonces
//     // generate previous state
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [5, 10],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [5, 0],
//     })
//   })

//   it('should return null for valid state transtition', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should return null for valid state transition of deposits', () => {
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 5],
//       pendingDepositWei: [5, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [15, 15],
//       balanceToken: [15, 15],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should return null for valid state transition of withdrawals', () => {
//     // set previous to have no deposits and withdrawals
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [5, 5],
//       pendingWithdrawalWei: [5, 5],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if timeout is nonzero', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Timeouts should be 0 on confirm pending updates (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub wei deposit is added incorrectly', () => {
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [5, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Hub wei pending deposit added incorrectly (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the hub token deposit is added incorrectly', () => {
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [5, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `Hub token pending deposit added incorrectly (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user wei deposit is added incorrectly', () => {
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 5],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `User wei pending deposit added incorrectly (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user token deposit is added incorrectly', () => {
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 5],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       pendingDepositToken: [0, 0],
//       pendingDepositWei: [0, 0],
//       pendingWithdrawalToken: [0, 0],
//       pendingWithdrawalWei: [0, 0],
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'ConfirmPending',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//       }),
//     ).to.equal(
//       `User token pending deposit added incorrectly (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::Exchange', () => {
//   let web3: any
//   let accounts: string[]
//   let payment: any
//   let user: string
//   let hubAddress: string
//   let previous: any
//   let current: UnsignedChannelState

//   beforeEach('generate previous state', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     // generate previous state
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [0, 10],
//       balanceToken: [10, 0],
//       timeout: 0,
//     })

//     payment = {
//       wei: '5',
//       token: '5',
//     }
//   })

//   it('should return null for a valid exchange', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if the timeout is nonzero', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Timeouts should be 0 on exchange updates (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if the chain txcount changes', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: previous.txCountChain + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Exchanges should take place off chain in capitalized channels (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if the wei exchanged is 0', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.wei = '0'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Exchanges should include both wei and token amounts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if the token exchanged is 0', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.token = '0'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Exchanges should include both wei and token amounts (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if user has insufficient wei for exchange', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.wei = '15'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Channel user does not have sufficient wei for proposed exchange (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if user has insufficient tokens for exchange', () => {
//     // generate previous state
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 0],
//       balanceToken: [0, 10],
//       timeout: 0,
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.token = '15'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Channel user does not have sufficient tokens for proposed exchange (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if hub has insufficient tokens for exchange', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.token = '15'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Hub does not have sufficient tokens for proposed exchange (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if hub has insufficient wei for exchange', () => {
//     // generate previous state
//     previous = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 0],
//       balanceToken: [0, 10],
//       timeout: 0,
//     })
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     payment.wei = '15'
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Hub does not have sufficient wei for proposed exchange (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if the wei balance is incorrect', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [6, 4],
//       balanceToken: [5, 5],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Wei balances incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })

//   it('should fail if the token balance is incorrect', () => {
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [3, 7],
//       timeout: 0,
//       txCountGlobal: previous.txCountGlobal + 1,
//     })

//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'Exchange',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         payment,
//         hubAddress,
//       }),
//     ).to.equal(
//       `Token balances incorrect (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))}, exchange: ${JSON.stringify(
//         payment,
//       )})`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::OpenThread', () => {
//   let web3: any
//   let accounts: string[]
//   let user: string
//   let hubAddress: string
//   let receiver: string
//   let previous: any
//   let previousReceiver: any
//   let current: any
//   let threadState: any
//   let threads: any[]

//   beforeEach('instantiate web3, create signed accounts', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     receiver = accounts[2]

//     // set up states to have correct sigs and nonces

//     // generate previous state
//     previous = t.getChannelState('full', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       threadCount: 0,
//     })

//     previousReceiver = t.getChannelState('full', {
//       user: receiver,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       threadCount: 0,
//     })
//     // create hash
//     const hashPrev = validation.utils.createChannelStateHash(previous)
//     // sign
//     const sigUserPrev = await web3.eth.sign(hashPrev, user)
//     const sigHubPrev = await web3.eth.sign(hashPrev, hubAddress)
//     // add to state
//     previous.sigUser = sigUserPrev
//     previous.sigHub = sigHubPrev
//   })

//   it('should return null for a valid transition where user === sender', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(null)
//   })

//   it('should return null for a valid transition where user === receiver', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if the sender is not a member of the channel', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     // sign thread state
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, user)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel user is not a member of thread state (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the receiver is not a member of the channel', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       receiver: accounts[5],
//       sender: user,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     // sign thread state
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     // generate and sign
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel user is not a member of thread state (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(
//         previousReceiver,
//       )}, \ncurrent: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if there is a starting receiver wei balance', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 1],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread wei receiver balance is not 0 (thread: ${JSON.stringify(
//         threadState,
//       )}`,
//     )
//   })

//   it('should fail if there is a starting receiver token balance', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 1],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread token receiver balance is not 0 (thread: ${JSON.stringify(
//         threadState,
//       )}`,
//     )
//   })

//   it('should fail if the contract address changes', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       contractAddress: hubAddress,
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Contract address of thread must be the same as the channel  (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the thread txCount is nonzero', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 1,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Cannot open a thread with an initial nonce different than 0 (thread: ${JSON.stringify(
//         threadState,
//       )}`,
//     )
//   })

//   it('should fail if the thread root is incorrect', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread root is incorrect (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the thread count is not increased properly', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread count must increase by one when opening a thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if user has insufficient wei balance to create a thread', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [15, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `User has insufficient wei balance to create thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if hub has insufficient wei balance to create a thread', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [15, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Hub has insufficient wei balance to create thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(
//         previousReceiver,
//       )}, \ncurrent: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if user has insufficient token balance to create a thread', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [15, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `User has insufficient token balance to create thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if hub has insufficient token balance to create a thread', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [15, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Hub has insufficient token balance to create thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(
//         previousReceiver,
//       )}, \ncurrent: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user wei channel balance is incorrectly decremented', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel user wei balance bond incorrect for thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the hub wei channel balance is incorrectly decremented', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [10, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel hub wei balance bond incorrect for thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(
//         previousReceiver,
//       )}, \ncurrent: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if the user token channel balance is incorrectly decremented', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user,
//       balanceWei: [10, 5],
//       balanceToken: [5, 10],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel user token balance bond incorrect for thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the hub token channel balance is incorrectly decremented', async () => {
//     // generate initial thread state
//     threadState = t.getThreadState('full', {
//       sender: user,
//       receiver,
//       balanceWei: [5, 0],
//       balanceToken: [5, 0],
//       txCount: 0,
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)
//     // set threads
//     threads = [threadState]
//     // generate hash
//     const threadRoot = validation.utils.generateThreadRootHash(threads)
//     // generate current channel state for user === sender
//     current = t.getChannelState('unsigned', {
//       user: receiver,
//       balanceWei: [5, 5],
//       balanceToken: [10, 5],
//       threadRoot,
//       threadCount: previous.threadCount + 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'OpenThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Channel hub token balance bond incorrect for thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(
//         previousReceiver,
//       )}, \ncurrent: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })
// })

// describe('validateChannelStateUpdate::CloseThread', () => {
//   let web3: any
//   let accounts: string[]
//   let user: string
//   let hubAddress: string
//   let receiver: string
//   let previous: any
//   let previousReceiver: any
//   let current: any
//   let threadState: any
//   let threads: ThreadState[] = []
//   let contractAddress: string

//   beforeEach('instantiate web3, create signed accounts', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//     receiver = accounts[2]
//     contractAddress = accounts[5]

//     // set up states to have correct sigs and nonces
//     threadState = t.getThreadState('full', {
//       contractAddress,
//       sender: user,
//       receiver,
//       balanceWei: [0, 5],
//       balanceToken: [0, 5],
//     })
//     const hash = validation.utils.createThreadStateHash(threadState)
//     threadState.sigA = await web3.eth.sign(hash, threadState.sender)

//     // generate previous state
//     previous = t.getChannelState('unsigned', {
//       contractAddress,
//       user,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       threadCount: 1,
//     })

//     previousReceiver = t.getChannelState('unsigned', {
//       contractAddress,
//       user: receiver,
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       threadCount: 1,
//     })
//   })

//   it('should work for a valid thread closing in senders channel', () => {
//     current = t.getChannelState('unsigned', {
//       recipient: user,
//       contractAddress,
//       user,
//       balanceWei: [15, 10],
//       balanceToken: [15, 10],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(null)
//   })

//   it('should work for valid thread closing in receivers channel', () => {
//     current = t.getChannelState('unsigned', {
//       recipient: receiver,
//       contractAddress,
//       user: receiver,
//       balanceWei: [10, 15],
//       balanceToken: [10, 15],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: previousReceiver.threadCount - 1,
//       txCountGlobal: previous.txCountGlobal + 1,
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous: previousReceiver,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(null)
//   })

//   it('should fail if timeout is nonzero', () => {
//     current = t.getChannelState('unsigned', {
//       recipient: user,
//       contractAddress,
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Timeouts should be 0 on close thread updates (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(unsignedChannelStateToChannelState(current))})`,
//     )
//   })

//   it('should fail if thread count is not decreased by one', () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadRoot: validation.utils.emptyRootHash,
//       threadCount: previous.threadCount,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread count must decrease by one when closing a thread (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the root hash is incorrect and threads is provided', () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threads,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread root is incorrect (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if the root hash is unchanged and threads arent provided', () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//       }),
//     ).to.equal(
//       `Thread root is incorrect (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if channel user is not member of the thread', () => {
//     previous = t.getChannelState('unsigned', {
//       contractAddress,
//       user: accounts[5],
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//       threadCount: 1,
//     })
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user: accounts[5],
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Channel user is not a member of thread state (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if thread state does not have the same contract address', async () => {
//     threadState.contractAddress = accounts[9]
//     threadState.sigA = await web3.eth.sign(
//       validation.utils.createThreadStateHash(threadState),
//       threadState.sender,
//     )
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [5, 5],
//       balanceToken: [5, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Contract address of thread must be the same as the channel  (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if user wei balance is incorrect', async () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [5, 15],
//       balanceToken: [5, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Channel user wei balance incorrect for thread close (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if user token balance is incorrect', async () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [15, 10],
//       balanceToken: [15, 5],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Channel user token balance incorrect for thread close (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if hub wei balance is incorrect', async () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [10, 10],
//       balanceToken: [15, 10],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Hub wei balance incorrect for thread close (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })

//   it('should fail if hub token balance is incorrect', async () => {
//     current = t.getChannelState('unsigned', {
//       contractAddress,
//       recipient: user,
//       user,
//       threadRoot: validation.utils.emptyRootHash,
//       balanceWei: [15, 10],
//       balanceToken: [10, 10],
//       threadCount: previous.threadCount - 1,
//       txCount: [previous.txCountGlobal + 1, previous.txCountChain],
//       timeout: 0,
//     })
//     expect(
//       validation.validateChannelStateUpdate({
//         reason: 'CloseThread',
//         previous,
//         current: unsignedChannelStateToChannelState(current),
//         hubAddress,
//         threadState,
//         threads,
//       }),
//     ).to.equal(
//       `Hub token balance incorrect for thread close (thread: ${JSON.stringify(
//         threadState,
//       )},  \nprevious: ${JSON.stringify(previous)}, \ncurrent: ${JSON.stringify(
//         unsignedChannelStateToChannelState(current),
//       )})`,
//     )
//   })
// })

// describe('validateNoPendingBalanceChanges', () => {
//   it('should return null if there are no pending balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full')
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(null)
//   })

//   it('should fail if there are pending hub token deposit changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingDepositTokenHub: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending hub token deposit (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending user token deposit changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingDepositTokenUser: 10,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending user token deposit (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending hub wei deposit changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingDepositWeiHub: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending hub wei deposit (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending user wei deposit changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingDepositWeiUser: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending user wei deposit (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending hub token withdrawal changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingWithdrawalTokenHub: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending hub token withdrawal (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending user token withdrawal changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingWithdrawalTokenUser: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending user token withdrawal (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending hub wei withdrawal changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingWithdrawalWeiHub: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending hub wei withdrawal (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if there are pending user wei withdrawal changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       pendingWithdrawalWeiUser: 7,
//     })
//     expect(
//       validation.validateNoPendingBalanceChanges(previous, current),
//     ).to.equal(
//       `Cannot update pending user wei withdrawal (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })
// })

// describe('validateChannelTxCount', () => {
//   // check global nonce
//   it('should fail if the global nonce increases by more than 1', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       txCountGlobal: 7,
//     })
//     expect(validation.validateChannelTxCount(previous, current)).to.equal(
//       `Can only increase the global nonce by 1 (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if the global nonce does not change', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full')
//     expect(validation.validateChannelTxCount(previous, current)).to.equal(
//       `Can only increase the global nonce by 1 (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if the global nonce decreases', () => {
//     const previous = t.getChannelState('full', {
//       txCountGlobal: 3,
//     })
//     const current = t.getChannelState('full')
//     expect(validation.validateChannelTxCount(previous, current)).to.equal(
//       `Can only increase the global nonce by 1 (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   // check chain nonce
//   it('should fail if the chain nonce decreases', () => {
//     const previous = t.getChannelState('full', {
//       txCountChain: 33,
//     })
//     const current = t.getChannelState('full', {
//       txCountGlobal: previous.txCountGlobal + 1,
//     })
//     expect(validation.validateChannelTxCount(previous, current)).to.equal(
//       `Can only increase the chain nonce by 1 or not at all (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if the chain nonce increases by more than 1', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       txCountGlobal: previous.txCountGlobal + 1,
//       txCountChain: 33,
//     })
//     expect(validation.validateChannelTxCount(previous, current)).to.equal(
//       `Can only increase the chain nonce by 1 or not at all (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })
// })

// describe('validateChannelSigs', () => {
//   let web3: any
//   let accounts = []
//   let user: string
//   let hubAddress: string
//   before('instantiate web3', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//   })

//   it('should return null if the sigs are valid', async () => {
//     // generate state
//     let state = t.getChannelState('empty', {
//       user,
//     })
//     // create hash
//     const hash = validation.utils.createChannelStateHash(state)
//     // sign
//     const sigUser = await web3.eth.sign(hash, user)
//     const sigHub = await web3.eth.sign(hash, hubAddress)
//     // add to state
//     state.sigUser = sigUser
//     state.sigHub = sigHub
//     expect(validation.validateChannelSigs(state, hubAddress)).to.equal(null)
//   })

//   it('should return message if the sigUser is invalid', async () => {
//     // generate state
//     let state = t.getChannelState('full', {
//       user,
//     })
//     // create hash
//     const hash = validation.utils.createChannelStateHash(state)
//     // sign
//     const sigUser = await web3.eth.sign('fail', user)
//     const sigHub = await web3.eth.sign(hash, hubAddress)
//     // add to state
//     state.sigUser = sigUser
//     state.sigHub = sigHub
//     expect(validation.validateChannelSigs(state, hubAddress)).to.equal(
//       `Incorrect signer detected for sigUser in channel state (state: ${JSON.stringify(
//         state,
//       )}`,
//     )
//   })

//   it('should return message if the sigHub is invalid', async () => {
//     // generate state
//     let state = t.getChannelState('full', {
//       user,
//     })
//     // create hash
//     const hash = validation.utils.createChannelStateHash(state)
//     // sign
//     const sigUser = await web3.eth.sign(hash, user)
//     const sigHub = await web3.eth.sign('fail', hubAddress)
//     // add to state
//     state.sigUser = sigUser
//     state.sigHub = sigHub
//     expect(validation.validateChannelSigs(state, hubAddress)).to.equal(
//       `Incorrect signer detected for sigHub in channel state (state: ${JSON.stringify(
//         state,
//       )}`,
//     )
//   })
// })

// describe('validateThreadSigs', () => {
//   let web3: any
//   let accounts = []
//   let user: string
//   let hubAddress: string
//   before('instantiate web3', async () => {
//     // instantiate web3
//     web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account values
//     accounts = await web3.eth.getAccounts()
//     hubAddress = accounts[0]
//     user = accounts[1]
//   })

//   it('should return null if the sigs are valid', async () => {
//     // generate state
//     let state = t.getThreadState('empty', {
//       sender: user,
//     })
//     // create hash
//     const hash = validation.utils.createThreadStateHash(state)
//     // sign
//     state.sigA = await web3.eth.sign(hash, user)
//     expect(validation.validateThreadSigs(state)).to.equal(null)
//   })

//   it('should return a message if signer is not thread sender', async () => {
//     // generate state
//     let state = t.getThreadState('empty', {
//       sender: user,
//     })
//     // create hash
//     const hash = validation.utils.createThreadStateHash(state)
//     // sign
//     state.sigA = await web3.eth.sign(hash, hubAddress)
//     expect(validation.validateThreadSigs(state)).to.equal(
//       `Proposed thread state is not signed by sender (thread: ${JSON.stringify(
//         state,
//       )}`,
//     )
//   })
// })

// describe('validateAddress', () => {
//   let address = ''
//   before('instantiate web3', async () => {
//     // instantiate web3
//     const web3 = new Web3(new HttpProvider(process.env.ETH_NODE_URL))
//     // set default account value
//     const accounts = await web3.eth.getAccounts()
//     address = accounts[0]
//   })

//   it('should return null for a valid address', () => {
//     expect(validation.validateAddress(address)).to.equal(null)
//   })

//   it('should return a message for invalid address', () => {
//     expect(validation.validateAddress(';)')).to.equal(
//       'Not a valid address (;))',
//     )
//   })
// })

// describe('validateNoOperatingBalanceChanges', () => {
//   it('should return null for a state without channel balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full')
//     expect(
//       validation.validateNoOperatingBalanceChanges(previous, current),
//     ).to.equal(null)
//   })

//   it('should return a message for a state with hub wei channel balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       balanceWeiHub: '6',
//     })
//     expect(
//       validation.validateNoOperatingBalanceChanges(previous, current),
//     ).to.equal(
//       `Channel hub wei balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should return a message for a state with hub token channel balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       balanceTokenHub: '6',
//     })
//     expect(
//       validation.validateNoOperatingBalanceChanges(previous, current),
//     ).to.equal(
//       `Channel hub token balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should return a message for a state with user wei channel balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       balanceWeiUser: '6',
//     })
//     expect(
//       validation.validateNoOperatingBalanceChanges(previous, current),
//     ).to.equal(
//       `Channel user wei balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should return a message for a state with user token channel balance changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       balanceTokenUser: '6',
//     })
//     expect(
//       validation.validateNoOperatingBalanceChanges(previous, current),
//     ).to.equal(
//       `Channel user token balances cannot change (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })
// })

// describe('validateNoOpenThreadChanges', () => {
//   it('should return null for a state without thread changes', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full')
//     expect(validation.validateNoOpenThreadChanges(previous, current)).to.equal(
//       null,
//     )
//   })

//   it('should return a message for a state with a new thread count', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       threadCount: 6,
//     })
//     expect(validation.validateNoOpenThreadChanges(previous, current)).to.equal(
//       `Cannot modify thread count (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should return a message for a state with a new thread root', () => {
//     const previous = t.getChannelState('full')
//     const current = t.getChannelState('full', {
//       threadRoot: t.mkHash('root'),
//     })
//     expect(validation.validateNoOpenThreadChanges(previous, current)).to.equal(
//       `Cannot modify the thread root (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })
// })

// describe('validateNoPendingOps', () => {
//   it('should return null for a state without pending balances', () => {
//     const state = t.getChannelState('empty')
//     expect(validation.validateNoPendingOps(state)).to.equal(null)
//   })

//   it('should return a message for a state with pending hub wei deposit', () => {
//     const state = t.getChannelState('empty', {
//       pendingDepositWeiHub: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending hub wei deposit exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending hub wei withdrawal', () => {
//     const state = t.getChannelState('empty', {
//       pendingWithdrawalWeiHub: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending hub wei withdrawal exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending hub token deposit', () => {
//     const state = t.getChannelState('empty', {
//       pendingDepositTokenHub: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending hub token deposit exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending hub token withdrawal', () => {
//     const state = t.getChannelState('empty', {
//       pendingWithdrawalTokenHub: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending hub token withdrawal exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending user wei deposit', () => {
//     const state = t.getChannelState('empty', {
//       pendingDepositWeiUser: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending user wei deposit exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending user wei withdrawal', () => {
//     const state = t.getChannelState('empty', {
//       pendingWithdrawalWeiUser: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending user wei withdrawal exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending user token deposit', () => {
//     const state = t.getChannelState('empty', {
//       pendingDepositTokenUser: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending user token deposit exists (state: ${JSON.stringify(state)})`,
//     )
//   })

//   it('should return a message for a state with pending user token withdrawal', () => {
//     const state = t.getChannelState('empty', {
//       pendingWithdrawalTokenUser: '6',
//     })
//     expect(validation.validateNoPendingOps(state)).to.equal(
//       `Pending user token withdrawal exists (state: ${JSON.stringify(state)})`,
//     )
//   })
// })

// describe('validateChannelBalanceConserved', () => {
//   let previous: UnsignedChannelState
//   before('set previous state', () => {
//     // generate previous state
//     previous = t.getChannelState('full', {
//       balanceWei: [10, 10],
//       balanceToken: [10, 10],
//     })
//   })

//   it('should fail if channel wei balance is not conserved', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       balanceToken: [10, 10],
//       balanceWei: [20, 10],
//     })
//     expect(
//       validation.validateChannelBalanceConserved(previous, current),
//     ).to.equal(
//       `Cannot change total wei operating balance of the channel (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })

//   it('should fail if channel token balance is not conserved', async () => {
//     // update current channel state
//     const current = t.getChannelState('full', {
//       balanceWei: [10, 10],
//       balanceToken: [20, 10],
//     })

//     expect(
//       validation.validateChannelBalanceConserved(previous, current),
//     ).to.equal(
//       `Cannot change total token operating balance of the channel (previous: ${JSON.stringify(
//         previous,
//       )}, current: ${JSON.stringify(current)})`,
//     )
//   })
// })