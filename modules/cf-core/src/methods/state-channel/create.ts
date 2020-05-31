import {
  CreateChannelMessage,
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";

import { NO_MULTISIG_FOR_COUNTERPARTIES } from "../../errors";
import { RequestHandler } from "../../request-handler";
import { getCreate2MultisigAddress } from "../../utils";

import { MethodController } from "../controller";

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
export class CreateChannelController extends MethodController {
  public readonly methodName = MethodNames.chan_create || "unknown";

  public executeMethod = super.executeMethod;

  protected async getRequiredLockName(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<string> {
    if (!params.owners) {
      throw new Error(`No owners provided in params. ${stringify(params)}`);
    }
    return `${MethodNames.chan_create}:${params.owners.sort().toString()}`;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<MethodResults.CreateChannel> {
    const { owners } = params;
    const { networkContext, store } = requestHandler;

    // safe to use network context proxy factory address directly here
    // using the assumption that `create` is only called for new state
    // channels. also because the `getMultisigAddressWithCounterparty` const
    // will default to using any existing multisig address for the provided
    // owners before creating one
    const { multisigAddress: storedMultisig } = (await store.getStateChannelByOwners(owners)) || {
      multisigAddress: undefined,
    };
    if (!networkContext.provider && !storedMultisig) {
      throw new Error(NO_MULTISIG_FOR_COUNTERPARTIES(owners));
    }
    const multisigAddress =
      storedMultisig ||
      (await getCreate2MultisigAddress(
        requestHandler.publicIdentifier,
        owners.find((id) => id !== requestHandler.publicIdentifier)!,
        networkContext.contractAddresses,
        networkContext.provider,
      ));
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
    const { publicIdentifier, protocolRunner, outgoing, router } = requestHandler;

    const [responderIdentifier] = owners.filter((x) => x !== publicIdentifier);

    await protocolRunner.runSetupProtocol(router, {
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
      },
    };

    outgoing.emit(EventNames.CREATE_CHANNEL_EVENT, msg);
  }
}
