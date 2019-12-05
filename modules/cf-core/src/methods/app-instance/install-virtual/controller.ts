import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { NodeController } from "../../controller";

import { installVirtual } from "./operation";

export default class InstallVirtualController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.INSTALL_VIRTUAL)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams,
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId, intermediaryIdentifier } = params;

    const multisigAddressWithHub = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
    );

    const proposal = await store.getAppInstanceProposal(appInstanceId);

    const { proposedByIdentifier } = proposal;

    // assume that there may not be existing sc between
    // virtual channel participants
    const multisigAddressWithResponding = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedByIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider
    );

    // because this is the initiators store, it may not have
    // access to this multisig address between the proposedBy
    // and the intermediary
    const multisigAddressBetweenHubAndResponding = await store.getMultisigAddressWithCounterparty(
      [intermediaryIdentifier, proposedByIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider
    );

    return [
      multisigAddressWithHub,
      multisigAddressWithResponding,
      multisigAddressBetweenHubAndResponding
    ];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams,
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { intermediaryIdentifier } = params;

    if (!intermediaryIdentifier) {
      throw Error("Cannot install virtual app: you did not provide an intermediary.");
    }

    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const stateChannelWithIntermediary = await store.getStateChannel(multisigAddress);

    if (!stateChannelWithIntermediary) {
      throw Error(
        "Cannot install virtual app: you do not have a channel with the intermediary provided.",
      );
    }

    if (!stateChannelWithIntermediary.freeBalance) {
      throw Error(
        "Cannot install virtual app: channel with intermediary has no free balance app instance installed.",
      );
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams,
  ): Promise<Node.InstallVirtualResult> {
    const { store, protocolRunner } = requestHandler;

    const { appInstanceId } = params;

    await store.getAppInstanceProposal(appInstanceId);

    await installVirtual(store, protocolRunner, params);

    return {
      appInstance: (await store.getAppInstance(appInstanceId)).toJson(),
    };
  }
}
