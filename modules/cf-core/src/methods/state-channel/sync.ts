import {
  MethodNames,
  MethodParams,
  MethodResults,
  ProtocolNames,
} from "@connext/types";

import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";
import { NO_STATE_CHANNEL_FOR_MULTISIG_ADDR } from "../../errors";
import { StateChannel } from "../../models";

export class SyncController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_sync)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.Sync,
  ): Promise<string[]> {
    return [params.multisigAddress];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.Sync,
  ): Promise<MethodResults.Sync> {
    const { protocolRunner, store, publicIdentifier } = requestHandler;
    const { multisigAddress } = params;
    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    const channel = StateChannel.fromJson(json);
    const responderIdentifier = [channel.initiatorIdentifier, channel.responderIdentifier].find(
      (identifier) => identifier !== publicIdentifier,
    );

    if (!responderIdentifier) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    await protocolRunner.initiateProtocol(ProtocolNames.sync, {
      multisigAddress,
      initiatorIdentifier: publicIdentifier,
      responderIdentifier,
    });

    return {};
  }
}
