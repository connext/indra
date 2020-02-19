import { sendDisputeTransaction } from "../set-state/operation";
import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "@connext/types";

const SET_STATE_WITH_ACTION_RETRY_COUNT = 3;

export async function submitSetStateWithAction(
  requestHandler: RequestHandler,
  params: CFCoreTypes.SetStateWithActionParams, // should be set state with action params
  // but unclear on what those should include atm
): Promise<string | undefined> {
  const { store } = requestHandler;
  const { appInstanceId } = params;

  const app = await store.getAppInstance(appInstanceId);

  const stateSigs = ["wtf", "where"];
  // should we pass in an
  const action = "idk where this should be stored";
  const actionSig = ["idk how this should be fetched"];

  const contractParameters = [
    app.identity,
    {
      appState: app.latestState,
      signatures: stateSigs,
      timeout: app.timeout,
      versionNumber: app.versionNumber,
    },
    {
      encodedAction: app.encodeAction(action),
      signature: actionSig,
    },
  ];

  return sendDisputeTransaction(
    "setStateWithAction",
    contractParameters,
    SET_STATE_WITH_ACTION_RETRY_COUNT,
    requestHandler,
    params,
  );
}
