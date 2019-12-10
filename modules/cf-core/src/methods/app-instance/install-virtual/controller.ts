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
    params: Node.InstallVirtualParams
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId, intermediaryIdentifier } = params;

    // no provider used, should never generate a new multisig address
    const multisigAddressWithHub = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const proposal = await store.getAppInstanceProposal(appInstanceId);

    const { proposedByIdentifier, proposedToIdentifier } = proposal;
    const responding =
      proposedByIdentifier === publicIdentifier
        ? proposedToIdentifier
        : proposedByIdentifier;

    // do not provide the networkContext provider here. in the case
    // where a virtual app is being installed, it *should* have gone
    // through the `propose` protocol flow successfully. this means that
    // at the end of the flow a new state channel between responder and
    // intiator has been persisted to the store, and any generated multisig
    // address allowed here could be incorrect.
    // NOTE: there is an edge case where the channel was restored from the
    // intermediary node, and has no information about proposed virtual apps.
    // for now, error in that edge case (should repeat the propose flow since
    // there is no cost or free balance decrement there).
    const multisigAddressWithResponding = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, responding],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    // because this is the initiators store, it may not have access to
    // the multisig address beetween the hub and the responding party.
    // allow generation of multisig address.

    // NOTE: that there is an edge case where the proxy factory has been
    // redeployed and the queue name used here is *incorrect*, leading to
    // concurrency issues
    const multisigAddressBetweenHubAndResponding = await store.getMultisigAddressWithCounterparty(
      [intermediaryIdentifier, responding],
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
    params: Node.InstallVirtualParams
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { intermediaryIdentifier } = params;

    if (!intermediaryIdentifier) {
      throw Error(
        "Cannot install virtual app: you did not provide an intermediary."
      );
    }

    // no provider used, should never generate a new multisig address
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, intermediaryIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const stateChannelWithIntermediary = await store.getStateChannel(
      multisigAddress
    );

    if (!stateChannelWithIntermediary) {
      throw Error(
        "Cannot install virtual app: you do not have a channel with the intermediary provided."
      );
    }

    if (!stateChannelWithIntermediary.freeBalance) {
      throw Error(
        "Cannot install virtual app: channel with intermediary has no free balance app instance installed."
      );
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams
  ): Promise<Node.InstallVirtualResult> {
    const { store, protocolRunner } = requestHandler;

    const { appInstanceId } = params;

    await store.getAppInstanceProposal(appInstanceId);

    await installVirtual(store, protocolRunner, params);

    return {
      appInstance: (await store.getAppInstance(appInstanceId)).toJson()
    };
  }
}
