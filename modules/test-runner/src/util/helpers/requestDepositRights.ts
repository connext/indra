import { utils } from "@connext/client";
import { AppInstanceJson, CoinBalanceRefundAppState, IConnextClient } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { expect } from "../assertions";
import { ethProvider } from "../ethprovider";

const { xpubToAddress } = utils;

export const requestDepositRights = async (
  client: IConnextClient,
  assetId: string = AddressZero,
  clientIsRecipient: boolean = true,
): Promise<void> => {
  // NOTE: will use instantaneous multisig balance as the assumed balance
  const multisigBalance =
    assetId === AddressZero
      ? await ethProvider.getBalance(client.multisigAddress)
      : await new Contract(assetId, tokenAbi, ethProvider).functions.balanceOf(
          client.multisigAddress,
        );
  // get coin balance app details
  const {
    actionEncoding,
    appDefinitionAddress: appDefinition,
    stateEncoding,
    outcomeType,
  } = client.getRegisteredAppDetails("CoinBalanceRefundApp");
  // install the app and get the state
  let coinBalanceAppState: CoinBalanceRefundAppState;
  if (clientIsRecipient) {
    // give client rights
    await client.requestDepositRights({ assetId });
    // get latest installed app
    const latestApp = (await client.getAppInstances(client.multisigAddress)).sort(
      (a: AppInstanceJson, b: AppInstanceJson) => b.appSeqNo - a.appSeqNo,
    )[0];
    // make sure its the coin balance refund app
    expect(latestApp.appInterface.addr).toEqual(appDefinition);
    coinBalanceAppState = latestApp.latestState as CoinBalanceRefundAppState;
  } else {
    // node is installing, params must be manually generated
    const initialState = {
      multisig: client.multisigAddress,
      recipient: xpubToAddress(client.nodePublicIdentifier),
      threshold: multisigBalance,
      tokenAddress: assetId,
    };

    const params = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: client.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };
    const { appInstanceId } = await client.proposeInstallApp(params);
    // hub will not automatically install, so manually install app
    const { appInstance } = await client.installApp(appInstanceId);
    // get latest coin balance state
    coinBalanceAppState = appInstance.latestState as CoinBalanceRefundAppState;
  }
  // verify the latest coin balance state is correct
  expect(coinBalanceAppState.multisig).toEqual(client.multisigAddress);
  expect(coinBalanceAppState.recipient).toEqual(
    clientIsRecipient ? client.freeBalanceAddress : xpubToAddress(client.nodePublicIdentifier),
  );
  expect(coinBalanceAppState.tokenAddress).toEqual(assetId);
  expect(coinBalanceAppState.threshold.toString()).to.be.eq(multisigBalance.toString());
};
