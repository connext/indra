import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { NodeController } from "../../controller";

import { install } from "./operation";

/**
 * This converts a proposed app instance to an installed app instance while
 * sending an approved ack to the proposer.
 * @param params
 */
export default class InstallController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_install)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.InstallParams
  ): Promise<string[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

    return [sc.multisigAddress];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.InstallParams
  ): Promise<CFCoreTypes.InstallResult> {
    const { store, protocolRunner, publicIdentifier } = requestHandler;

    const appInstanceProposal = await install(
      store,
      protocolRunner,
      params,
      publicIdentifier
    );

    return {
      appInstance: (
        await store.getAppInstance(appInstanceProposal.identityHash)
      ).toJson()
    };
  }
}
