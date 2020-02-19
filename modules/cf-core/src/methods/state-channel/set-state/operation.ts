import { ChallengeRegistry } from "@connext/contracts";
import {
  CHALLENGE_INITIATION_FAILED_EVENT,
  CHALLENGE_INITIATION_STARTED_EVENT,
} from "@connext/types";
import { Contract } from "ethers";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { TransactionResponse, BaseProvider } from "ethers/providers";
import {
  SET_STATE_FAILED,
  INCORRECT_CHALLENGE_STATUS,
  CHALLENGE_PERIOD_ELAPSED,
} from "../../errors";
import { StateChannel } from "../../../models";

const SET_STATE_RETRY_COUNT = 3;

export async function submitSetState(
  requestHandler: RequestHandler,
  params: CFCoreTypes.SetStateParams,
): Promise<string | undefined> {
  const { store } = requestHandler;
  const { appInstanceId } = params;

  const app = await store.getAppInstance(appInstanceId);

  const signatures = ["wtf", "where"];

  const contractParameters = [
    app.identity,
    {
      appStateHash: app.hashOfLatestState,
      signatures,
      timeout: app.timeout,
      versionNumber: app.versionNumber,
    },
  ];
  return sendDisputeTransaction(
    "setState",
    contractParameters,
    SET_STATE_RETRY_COUNT,
    requestHandler,
    params,
  );
}

export async function sendDisputeTransaction(
  functionName: string,
  contractParameters: any,
  retries: number,
  requestHandler: RequestHandler,
  params: CFCoreTypes.SetStateParams, // ANY dispute params
): Promise<string | undefined> {
  const {
    blocksNeededForConfirmation,
    networkContext,
    outgoing,
    publicIdentifier,
  } = requestHandler;

  const { appInstanceId } = params;

  const signer = await requestHandler.getSigner();

  let txResponse: TransactionResponse;

  let retryCount = retries;
  const errors: string[] = [];
  while (retryCount > 0) {
    try {
      const challengeRegistry = new Contract(
        networkContext.ChallengeRegistry,
        ChallengeRegistry.abi,
        signer,
      );
      txResponse = await challengeRegistry.functions[functionName](...contractParameters);
      break;
    } catch (e) {
      errors.push(e.toString());
      if (e.toString().includes(`reject`) || e.toString().includes(`denied`)) {
        outgoing.emit(CHALLENGE_INITIATION_FAILED_EVENT, { errors, params });
        throw Error(`${SET_STATE_FAILED(appInstanceId)}: ${e.message}`);
      }

      retryCount -= 1;

      if (retryCount === 0) {
        outgoing.emit(CHALLENGE_INITIATION_FAILED_EVENT, { errors, params });
        throw Error(`${SET_STATE_FAILED(appInstanceId)}: ${e.message}`);
      }
    }
  }

  outgoing.emit(CHALLENGE_INITIATION_STARTED_EVENT, {
    from: publicIdentifier,
    type: CHALLENGE_INITIATION_STARTED_EVENT,
    data: {
      txHash: txResponse!.hash,
    },
  });

  await txResponse!.wait(blocksNeededForConfirmation);
  return txResponse!.hash;
}

export async function validateChallenge(
  appInstanceId: string,
  provider: BaseProvider,
  channel: StateChannel,
): Promise<void> {
  const challenge = channel.getChallengeByAppID(appInstanceId);
  if (!challenge) {
    // just because it does not exist does not mean it is not
    // an active challenge
    return;
  }

  // make sure its status is fine and the timeout is compatible
  if (challenge.status === "OUTCOME_SET" || challenge.status === "EXPLICITLY_FINALIZED") {
    throw Error(INCORRECT_CHALLENGE_STATUS);
  }

  const currBlock = await provider.getBlockNumber();
  if (challenge.finalizesAt.lte(currBlock)) {
    throw Error(CHALLENGE_PERIOD_ELAPSED(currBlock, challenge.finalizesAt));
  }
}
