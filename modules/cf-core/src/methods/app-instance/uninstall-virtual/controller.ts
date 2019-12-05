import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import {
  getFirstElementInListNotEqualTo
} from "../../../utils";
import { NodeController } from "../../controller";
import {
  APP_ALREADY_UNINSTALLED,
  NO_APP_INSTANCE_ID_TO_UNINSTALL
} from "../../errors";

import { uninstallVirtualAppInstanceFromChannel } from "./operation";

export default class UninstallVirtualController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.UNINSTALL_VIRTUAL)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.UninstallVirtualParams
  ): Promise<string[]> {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId, intermediaryIdentifier } = params;

    const multisigAddressForStateChannelWithIntermediary = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
    );

    const stateChannelWithResponding = await store.getChannelFromAppInstanceID(
      appInstanceId
    );

    // because this is the initiators store, it may not have
    // access to this multisig address between the proposedBy
    // and the intermediary
    const multisigAddressBetweenHubAndResponding = await store.getMultisigAddressWithCounterparty(
      [
        stateChannelWithResponding.userNeuteredExtendedKeys.filter(
          x => x !== publicIdentifier
        )[0],
        intermediaryIdentifier
      ],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider
    );

    return [
      stateChannelWithResponding.multisigAddress,
      multisigAddressForStateChannelWithIntermediary,
      multisigAddressBetweenHubAndResponding,
      appInstanceId
    ];
  }

  protected async beforeExecution(
    // @ts-ignore
    requestHandler: RequestHandler,
    params: Node.UninstallVirtualParams
  ) {
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.UninstallVirtualParams
  ): Promise<Node.UninstallVirtualResult> {
    const {
      store,
      protocolRunner,
      publicIdentifier,
      provider
    } = requestHandler;

    const { appInstanceId, intermediaryIdentifier } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.hasAppInstance(appInstanceId)) {
      throw Error(APP_ALREADY_UNINSTALLED(appInstanceId));
    }

    const to = getFirstElementInListNotEqualTo(
      publicIdentifier,
      stateChannel.userNeuteredExtendedKeys
    );

    await uninstallVirtualAppInstanceFromChannel(
      store,
      protocolRunner,
      provider,
      publicIdentifier,
      to,
      intermediaryIdentifier,
      appInstanceId
    );

    return {};
  }
}
