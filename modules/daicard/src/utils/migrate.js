import * as Connext from "connext";
import { Zero } from "ethers/constants";
import { formatEther } from "ethers/utils";

import { toBN } from './bn';

export const migrate = async (hubUrl, wallet, ethUrl) => {
  console.log(`____________________Migration Started`)
  const legacy = await Connext.createClient({ ethUrl, hubUrl, mnemonic: wallet.mnemonic });
  await legacy.start();
  const state = (await legacy.getState());
  const latestState = state.persistent.latestValidState

  const tokenBalance = toBN(latestState.balanceTokenUser);
  const etherBalance = toBN(latestState.balanceWeiUser);
  console.log(`Legacy channel has a balance of $${formatEther(tokenBalance)}`);

  const amountToken = tokenBalance.add(state.persistent.custodialBalance.balanceToken);
  const amountWei = etherBalance.add(state.persistent.custodialBalance.balanceWei);

  const withdrawalParams = {
    exchangeRate: state.runtime.exchangeRate.rates.DAI,
    tokensToSell: amountToken.toString(),
    withdrawalWeiUser: amountWei.toString(),
    weiToSell: "0",
    withdrawalTokenUser: "0"
  }

  if (amountToken.gt(Zero) || amountWei.gt(Zero)) {
    console.log(`Cashing out legacy channel: ${JSON.stringify(
      withdrawalParams,
      (key, value) => value._hex ? toBN(value._hex).toString() : value,
      2,
    )}`);
    /*
    await legacy.withdraw(withdrawalParams);
    */
  }
  await legacy.stop();
  return;
};
