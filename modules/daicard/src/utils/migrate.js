import * as Connext from "connext";
import { Zero } from "ethers/constants";
import { formatEther } from "ethers/utils";

import { toBN } from './bn';

export const migrate = async (hubUrl, wallet, ethUrl, setMigrating) => {
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

  if (amountToken.gt(Zero) || amountWei.gt(Zero)) {
    await setMigrating(true);

    const withdrawalParams = {
      exchangeRate: state.runtime.exchangeRate.rates.DAI,
      tokensToSell: amountToken.toString(),
      withdrawalWeiUser: amountWei.toString(),
      weiToSell: "0",
      withdrawalTokenUser: "0"
    }

    console.log(`Cashing out legacy channel: ${JSON.stringify(
      withdrawalParams,
      (key, value) => value._hex ? toBN(value._hex).toString() : value,
      2,
    )}`);

    try {
      // To debug: simulate a withdrawal by just waiting for a bit
      await new Promise((res, rej) => setTimeout(res, 5000));
      // await legacy.withdraw(withdrawalParams);
    } catch (e) {
      console.error(e);
    }
    setMigrating(false);
  }
  await legacy.stop();
  console.log(`____________________Migration Finished`)
  return;
};
