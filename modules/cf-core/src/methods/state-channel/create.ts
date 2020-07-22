import {
  CreateChannelMessage,
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";

import { NO_NETWORK_PROVIDER_FOR_CHAIN_ID } from "../../errors";
import { RequestHandler } from "../../request-handler";
import { getCreate2MultisigAddress } from "../../utils";

import { MethodController } from "../controller";

/**
 * This instantiates a StateChannel object to encapsulate the "channel"
 * having been opened via the deterministical calculation of the multisig contract's
 * address.
 *
 * This then sends the details of this multisig to the peer with whom the multisig
 * is owned and the multisig's _address_ is sent as an event
 * to whoever subscribed to the `CREATE_CHANNEL_EVENT` event on the Node.
 */
export class CreateChannelController extends MethodController {
  public readonly methodName = MethodNames.chan_create || "unknown";

  public executeMethod = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<string[]> {
    if (!params.owners) {
      throw new Error(`No owners provided in params. ${stringify(params)}`);
    }
    return [`${MethodNames.chan_create}:${params.owners.sort().toString()}`];
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.CreateChannel,
  ): Promise<MethodResults.CreateChannel> {
    const { owners, chainId } = params;
    const { networkContexts, store } = requestHandler;

    // safe to use network context proxy factory address directly here
    // using the assumption that `create` is only called for new state
    // channels. also because the `getMultisigAddressWithCounterparty` const
    // will default to using any existing multisig address for the provided
    // owners before creating one
    const { multisigAddress: storedMultisig } = (await store.getStateChannelByOwnersAndChainId(
      owners,
      chainId,
    )) || {
      multisigAddress: undefined,
    };

    const networkContext = networkContexts[chainId];
    if (!networkContext?.provider) {
      throw new Error(NO_NETWORK_PROVIDER_FOR_CHAIN_ID(chainId));
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
      chainId: params.chainId,
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
