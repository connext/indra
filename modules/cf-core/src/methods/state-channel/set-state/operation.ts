import { ChallengeRegistry } from "@connext/contracts";
import {
  CHALLENGE_INTIATION_FAILED_EVENT,
  CHALLENGE_INTIATION_STARTED_EVENT,
} from "@connext/types";
import { Contract } from "ethers";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { TransactionResponse } from "ethers/providers";
import { SET_STATE_FAILED } from "../../errors";

const SET_STATE_RETRY_COUNT = 3;

export async function submitSetState(
  requestHandler: RequestHandler,
  params: CFCoreTypes.SetStateParams,
): Promise<string | undefined> {
  const {
    blocksNeededForConfirmation,
    networkContext,
    outgoing,
    publicIdentifier,
    store,
  } = requestHandler;
  const { appInstanceId } = params;

  const app = await store.getAppInstance(appInstanceId);

  const signer = await requestHandler.getSigner();
  const signatures = ["wtf", "where"];

  let txResponse: TransactionResponse;

  let retryCount = SET_STATE_RETRY_COUNT;
  const errors: string[] = [];
  while (retryCount > 0) {
    try {
      const challengeRegistry = new Contract(
        networkContext.ChallengeRegistry,
        ChallengeRegistry.abi,
        signer,
      );
      txResponse = await challengeRegistry.functions.setState(app.identity, {
        appStateHash: app.hashOfLatestState,
        signatures,
        timeout: app.timeout,
        versionNumber: app.versionNumber,
      });

      break;
    } catch (e) {
      errors.push(e.toString());
      if (e.toString().includes(`reject`) || e.toString().includes(`denied`)) {
        outgoing.emit(CHALLENGE_INTIATION_FAILED_EVENT, { errors, params });
        throw Error(`${SET_STATE_FAILED(appInstanceId)}: ${e.message}`);
      }

      retryCount -= 1;

      if (retryCount === 0) {
        outgoing.emit(CHALLENGE_INTIATION_FAILED_EVENT, { errors, params });
        throw Error(`${SET_STATE_FAILED(appInstanceId)}: ${e.message}`);
      }
    }
  }

  outgoing.emit(CHALLENGE_INTIATION_STARTED_EVENT, {
    from: publicIdentifier,
    type: CHALLENGE_INTIATION_STARTED_EVENT,
    data: {
      txHash: txResponse!.hash,
    },
  });

  await txResponse!.wait(blocksNeededForConfirmation);
  return txResponse!.hash;
}
