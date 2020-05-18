import * as Connext from "connext";
import { utils, constants, BigNumber } from "ethers";
import interval from "interval-promise";

const { formatEther } = utils;
const { Zero } = constants;

export const migrate = async (hubUrl, wallet, ethUrl) => {
  console.log(`==== Migration Started | hubUrl: ${hubUrl}, ethUrl: ${ethUrl}`);
  if (!hubUrl) {
    return;
  }
  const legacy = await Connext.createClient({ ethUrl, hubUrl, mnemonic: wallet.mnemonic.phrase });
  await legacy.start();
  const state = await legacy.getState();
  const latestState = state.persistent.latestValidState;

  const tokenBalance = BigNumber.from(latestState.balanceTokenUser);
  const etherBalance = BigNumber.from(latestState.balanceWeiUser);
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
        (key, value) => (value._hex ? BigNumber.from(value._hex).toString() : value),
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
