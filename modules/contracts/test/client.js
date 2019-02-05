// Instantiate the utils and the generator class imported from the client
// these are static classes, wrapped by the validator class, that handle
// core contract logic. (import from the compiled js files)
// NOTE: ts files are easier to read, so look at `camsite/client` 
// for fn input/logic.
const { Utils } = require("../client/dist/Utils.js");
const { StateGenerator } = require("../client/dist/StateGenerator.js")

const clientUtils = new Utils()

const stateGenerator = new StateGenerator()

// The validator class includes methods to generate a valid transition
// from given previous states and args. While this class wraps the static 
// `Utils` and `StateGenerator` classes, it should be used explicitly for
// happy case tests, and the errors returned should be examined in failure
// case tests to ensure consistency between the contract and client logic.

// You instantiate the Validator class with a web3 object and a hubAddress

const { Validator } = require("../client/dist/validator.js")

// In addition, the client contains several helpful functions for generating 
// previous states and args for supplying to the `StateGenerator`, `Utils`, 
// and `Validator` classes.

const { convertChannelState, convertDeposit, convertExchange, } = require("../client/dist/types")
const { mkAddress, getChannelState, getThreadState, getDepositArgs, getWithdrawalArgs, getExchangeArgs, getPaymentArgs, assertThreadStateEqual, assertChannelStateEqual } = require("../client/dist/testing")

// Cmd + F "using the client" to see an example of code usage in this context.
// Additional examples can be find throughout the tests that exist in the
// `camsite/client`.

describe('using the client', () => {
  it('should show a decent example of how to access fns', async () => {
    const hubAddress = mkAddress('0xHHH')
    const validator = new Validator(web3, hubAddress)
    const chan = getChannelState("empty", {
      balanceToken: [10, 0]
    })

    const thread = getThreadState("full", {
      balanceToken: [5, 0],
      balanceWeiSender: 7,
    })

    console.log(chan)
    console.log(clientUtils.createChannelStateHash(chan))
    assertThreadStateEqual(thread, {
      balanceToken: [5, 0],
      balanceWeiSender: 7,
    })
    assertChannelStateEqual(chan, {
      balanceToken: [10, 0]
    })


    // Applying and generating args
    const deposit = getDepositArgs("full", {
      depositWeiUser: 10,
    })
    const proposed = stateGenerator.proposePendingDeposit(
      convertChannelState("bn", chan),
      convertDeposit("bn", deposit)
    )
    const valid = validator.generateProposePendingDeposit(chan, deposit)
    assertChannelStateEqual(proposed, valid)
  })
})