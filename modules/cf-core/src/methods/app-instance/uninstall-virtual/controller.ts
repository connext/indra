import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { getFirstElementInListNotEqualTo } from "../../../utils";
import { NodeController } from "../../controller";
import {
  APP_ALREADY_UNINSTALLED,
  NO_APP_INSTANCE_ID_TO_UNINSTALL,
  NO_NETWORK_PROVIDER_CREATE2
} from "../../errors";

import { uninstallVirtualAppInstanceFromChannel } from "./operation";

export default class UninstallVirtualController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_uninstallVirtual)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallVirtualParams
  ): Promise<string[]> {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId, intermediaryIdentifier } = params;

    // safe to use network context proxy factory address directly here.
    // the `getMultisigAddressWithCounterparty` function will default
    // to using any existing multisig address for the provided
    // owners before creating one
    const multisigAddressForStateChannelWithIntermediary = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const stateChannelWithResponding = await store.getChannelFromAppInstanceID(
      appInstanceId
    );

    if (!networkContext.provider) {
      throw new Error(NO_NETWORK_PROVIDER_CREATE2);
    }

    // allow generation of create2 address here because the initiators
    // store may not have access to the channel between the responder
    // and the intermediary.

    // NOTE: there are edge cases where this generated multisig address
    // != the stored multisig address between the hub and the responder
    // this will result in incorrect locknames being used, and potentially
    // concurrency issues....
    // the ideal solution would be to confirm the correct multisig address
    // for this during install-virtual, and make sure its is included as a
    // parameter, or as a part of the virtual app state.
    const multisigAddressBetweenHubAndResponding = await store.getMultisigAddressWithCounterparty(
      [
        stateChannelWithResponding.userNeuteredExtendedKeys.filter(
          x => x !== publicIdentifier
        )[0],
        intermediaryIdentifier
      ],
      stateChannelWithResponding.proxyFactoryAddress,
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
    params: CFCoreTypes.UninstallVirtualParams
  ) {
    const { appInstanceId } = params;

    if (!appInstanceId) {
      throw Error(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.UninstallVirtualParams
  ): Promise<CFCoreTypes.UninstallVirtualResult> {
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
