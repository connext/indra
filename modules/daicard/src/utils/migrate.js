import * as Connext from "connext";
import { Zero } from "ethers/constants";
import { formatEther } from "ethers/utils";

import { toBN } from "./bn";
import interval from "interval-promise";

export const migrate = async (hubUrl, wallet, ethUrl) => {
  console.log(`==== Migration Started | hubUrl: ${hubUrl}, ethUrl: ${ethUrl}`);
  if (!hubUrl) {
    return;
  }
  const legacy = await Connext.createClient({ ethUrl, hubUrl, mnemonic: wallet.mnemonic });
  await legacy.start();
  const state = await legacy.getState();
  const latestState = state.persistent.latestValidState;

  const tokenBalance = toBN(latestState.balanceTokenUser);
  const etherBalance = toBN(latestState.balanceWeiUser);
  console.log(`Legacy channel has a balance of $${formatEther(tokenBalance)}`);

  const amountToken = tokenBalance.add(state.persistent.custodialBalance.balanceToken);
  const amountWei = etherBalance.add(state.persistent.custodialBalance.balanceWei);

  if (amountToken.gt(Zero) || amountWei.gt(Zero)) {
    const withdrawalParams = {
      exchangeRate: state.runtime.exchangeRate.rates.DAI,
      recipient: wallet.address,
      tokensToSell: amountToken.toString(),
      withdrawalWeiUser: amountWei.toString(),
      weiToSell: "0",
      withdrawalTokenUser: "0",
    };

    console.log(
      `Cashing out legacy channel: ${JSON.stringify(
        withdrawalParams,
        (key, value) => (value._hex ? toBN(value._hex).toString() : value),
        2,
      )}`,
    );

    try {
      await legacy.withdraw(withdrawalParams);
      // wait for a confirm pending to come through
      await interval(async (iteration, stop) => {
        const state = await legacy.getState();
        if (state.runtime.withdrawal.detected && state.runtime.withdrawal.submitted) {
          stop();
        }
      }, 500);
    } catch (e) {
      console.error(e);
    }
  }
  await legacy.stop();
  console.log(`==== Migration Finished`);
  return;
};
