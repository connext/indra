import {
  CreateChannelMessage,
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";

import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../request-handler";

import { NodeController } from "../controller";
import { getCreate2MultisigAddress } from "../../utils";
import { NO_MULTISIG_FOR_COUNTERPARTIES } from "../../errors";

/**
 * This instantiates a StateChannel object to encapsulate the "channel"
 * having been opened via the deterministical calculation of the multisig contract's
 * address. This also deploys the multisig contract to chain though it's not
 * strictly needed to deploy it here as per
 * https://github.com/counterfactual/monorepo/issues/1183.
 *
 * This then sends the details of this multisig to the peer with whom the multisig
 * is owned and the multisig's _address_ is sent as an event
 * to whoever subscribed to the `CREATE_CHANNEL_EVENT` event on the Node.
 */
export class CreateChannelController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_create)
  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<string[]> {
    return [`${MethodNames.chan_create}:${params.owners.sort().toString()}`];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<MethodResults.CreateChannel> {
    const { owners } = params;
    const { networkContext, store } = requestHandler;

    // safe to use network context proxy factory address directly here
    // using the assumption that `create` is only called for new state
    // channels. also because the `getMultisigAddressWithCounterparty` function
    // will default to using any existing multisig address for the provided
    // owners before creating one
    const { 
      multisigAddress: storedMultisig,
    } = await store.getStateChannelByOwners(owners) || { multisigAddress: undefined };
    if (!networkContext.provider && !storedMultisig) {
      throw new Error(NO_MULTISIG_FOR_COUNTERPARTIES(owners));
    }
    const multisigAddress = storedMultisig || await getCreate2MultisigAddress(
      requestHandler.publicIdentifier,
      owners.find(id => id !== requestHandler.publicIdentifier)!,
      { 
        proxyFactory: networkContext.ProxyFactory, 
        multisigMastercopy: networkContext.MinimumViableMultisig,
      },
      networkContext.provider,
    );
    // Check if the database has stored the relevant data for this state channel
    if (!storedMultisig) {
      await this.setupAndCreateChannel(multisigAddress, requestHandler, params);
    }

    return { multisigAddress };
  }

  private async setupAndCreateChannel(
    multisigAddress: string,
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ) {
    const { owners } = params;
    const { publicIdentifier, protocolRunner, outgoing } = requestHandler;

    const [responderIdentifier] = owners.filter(x => x !== publicIdentifier);

    await protocolRunner.runSetupProtocol({
      multisigAddress,
      responderIdentifier,
      initiatorIdentifier: publicIdentifier,
    });

    // use state channel for owners
    const addressOwners = [
      getSignerAddressFromPublicIdentifier(publicIdentifier),
      getSignerAddressFromPublicIdentifier(responderIdentifier),
    ];

    const msg: CreateChannelMessage = {
      from: publicIdentifier,
      type: EventNames.CREATE_CHANNEL_EVENT,
      data: {
        multisigAddress,
        owners: addressOwners,
        counterpartyIdentifier: responderIdentifier,
      } as MethodResults.CreateChannel,
    };

    outgoing.emit(EventNames.CREATE_CHANNEL_EVENT, msg);
  }
}
