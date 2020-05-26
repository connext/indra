import { MethodNames, MethodParams, MethodResults } from "@connext/types";

import { NO_NETWORK_PROVIDER_CREATE2, NO_MULTISIG_FOR_COUNTERPARTIES } from "../../errors";
import { RequestHandler } from "../../request-handler";
import { getCreate2MultisigAddress } from "../../utils";

import { MethodController } from "../controller";

export class GetStateDepositHolderAddressController extends MethodController {
  public readonly methodName = MethodNames.chan_getStateDepositHolderAddress;

  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.GetStateDepositHolderAddress,
  ): Promise<MethodResults.GetStateDepositHolderAddress> {
    const { owners } = params;
    const { networkContext, store } = requestHandler;
    if (!networkContext.provider) {
      throw new Error(NO_NETWORK_PROVIDER_CREATE2);
    }

    // safe to use network context proxy factory address directly here.
    // the `getMultisigAddressWithCounterparty` function will default
    // to using any existing multisig address for the provided
    // owners before creating one
    const { multisigAddress: storedMultisig } = (await store.getStateChannelByOwners(owners)) || {
      multisigAddress: undefined,
    };
    if (!networkContext.provider && !storedMultisig) {
      throw new Error(NO_MULTISIG_FOR_COUNTERPARTIES(owners));
    }
    const address =
      storedMultisig ||
      (await getCreate2MultisigAddress(
        owners[0],
        owners[1],
        networkContext.contractAddresses,
        networkContext.provider,
      ));

    return { address };
  }
}
