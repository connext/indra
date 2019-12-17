import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CreateChannelMessage, CFCoreTypes, NodeEvent } from "../../../types";
import { NodeController } from "../../controller";
import { xkeysToSortedKthAddresses } from "../../../machine";

/**
 * This instantiates a StateChannel object to encapsulate the "channel"
 * having been opened via the deterministical calculation of the multisig contract's
 * address. This also deploys the multisig contract to chain though it's not
 * strictly needed to deploy it here as per
 * https://github.com/counterfactual/monorepo/issues/1183.
 *
 * This then sends the details of this multisig to the peer with whom the multisig
 * is owned and the multisig's _address_ is sent as an event
 * to whoever subscribed to the `"CREATE_CHANNEL_EVENT"` event on the Node.
 */
export default class CreateChannelController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_create)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.CreateChannelParams
  ): Promise<string[]> {
    return [`${CFCoreTypes.RpcMethodNames.chan_create}:${params.owners.sort().toString()}`];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.CreateChannelParams
  ): Promise<CFCoreTypes.CreateChannelTransactionResult> {
    const { owners } = params;
    const { networkContext, store } = requestHandler;

    // safe to use network context proxy factory address directly here
    // using the assumption that `create` is only called for new state
    // channels. also because the `getMultisigAddressWithCounterparty` function
    // will default to using any existing multisig address for the provided
    // owners before creating one
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      owners,
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider
    );

    // Check if the database has stored the relevant data for this state channel
    if (!(await store.hasStateChannel(multisigAddress))) {
      await this.setupAndCreateChannel(multisigAddress, requestHandler, params);
    }

    return { multisigAddress };
  }

  private async setupAndCreateChannel(
    multisigAddress: string,
    requestHandler: RequestHandler,
    params: CFCoreTypes.CreateChannelParams
  ) {
    const { owners } = params;
    const {
      publicIdentifier,
      protocolRunner,
      outgoing,
      store
    } = requestHandler;

    const [responderXpub] = owners.filter(x => x !== publicIdentifier);

    await protocolRunner.runSetupProtocol({
      multisigAddress,
      responderXpub,
      initiatorXpub: publicIdentifier
    });

    // use state channel for owners
    const addressOwners = xkeysToSortedKthAddresses(owners, 0);

    const msg: CreateChannelMessage = {
      from: publicIdentifier,
      type: "CREATE_CHANNEL_EVENT" as NodeEvent,
      data: {
        multisigAddress,
        owners: addressOwners,
        counterpartyXpub: responderXpub
      } as CFCoreTypes.CreateChannelResult
    };

    outgoing.emit("CREATE_CHANNEL_EVENT", msg);
  }
}
