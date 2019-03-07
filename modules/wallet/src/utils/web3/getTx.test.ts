import MockWeb3 from "../../mocks/MockWeb3";
import getTx from "./getTx";
import {expect} from 'chai'

describe('getTx', () => {
  it('should get transaction from blockchain', async () => {
    const web3 = new MockWeb3()

    const transactionHash = '0xDummyTransactionHash'

    await getTx(web3 as any, transactionHash)

    // expect
    web3.eth.getTransactionWasCalledWith(transactionHash)
  })
})
