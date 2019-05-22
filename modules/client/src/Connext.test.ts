import { MockConnextInternal } from "./testing/mocks";
import { convertCustodialBalanceRow, CustodialBalanceRow, WithdrawalParameters } from "./types";
import { mkAddress, assert } from "./testing";
import { toBN } from "./lib/bn";

interface CustodialCalculation {
  custodialTokenWithdrawal: string,
  channelTokenWithdrawal: string,
  channelWeiWithdrawal: string,
  custodialWeiWithdrawal: string,
}

describe("calculateChannelWithdrawal", async () => {
  const createCustodialBalanceRow = (overrides: Partial<CustodialBalanceRow>) => {
    return convertCustodialBalanceRow("bn", {
      user: mkAddress("0xRRR"),
      totalReceivedWei: "0",
      totalReceivedToken: "0",
      totalWithdrawnToken: "0",
      totalWithdrawnWei: "0",
      balanceWei: "0",
      balanceToken: "0",
      sentWei: "0",
      ...overrides,
    })
  }

  // assertion functions
  const assertChannelWithdrawalCalculation = (
    withdrawal: Partial<WithdrawalParameters>, 
    custodialOverrides: Partial<CustodialBalanceRow>,
    expected: Partial<CustodialCalculation>
  ) => {
    const _withdrawal = {
      exchangeRate: "5",
      ...withdrawal,
    }

    let amountToken = toBN(_withdrawal.tokensToSell || 0)
    amountToken = amountToken.add(_withdrawal.withdrawalTokenUser || 0)

    let amountWei = toBN(_withdrawal.weiToSell || 0)
    amountToken = amountToken.add(_withdrawal.withdrawalWeiUser || 0)

    const _withdrawalSuccinct = {
      exchangeRate: "5",
      amountToken,
      amountWei
    }

    const custodial = createCustodialBalanceRow(custodialOverrides)

    const ans = new MockConnextInternal().calculateChannelWithdrawal(_withdrawal, custodial)

    const ans2 = new MockConnextInternal().calculateChannelWithdrawal(_withdrawalSuccinct, custodial)
    
    // values should be consistent if succinct or expanded wd vals given
    assert.deepEqual(ans, ans2)
    // assert they are both as expected
    assert.containSubset(ans, expected)
  }

  it("should withdraw entirely from custodial balance if withdrawal value is less than the custodial owed", async () => {
    const _withdrawal = {
      exchangeRate: "5",
      tokensToSell: "80",
      withdrawalWeiUser: "1",
    }

    const custodial = {
      totalReceivedToken: "100",
      balanceToken: "100",
    }

    assertChannelWithdrawalCalculation(_withdrawal, custodial, {
      custodialTokenWithdrawal: "80",
      channelTokenWithdrawal: "0",
      channelWeiWithdrawal: "1",
      custodialWeiWithdrawal: "0",
    })
  })
})