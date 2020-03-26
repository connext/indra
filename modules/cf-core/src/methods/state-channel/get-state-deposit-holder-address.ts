import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { NO_NETWORK_PROVIDER_CREATE2 } from "../../errors";
import { RequestHandler } from "../../request-handler";
import { NodeController } from "../controller";

export class GetStateDepositHolderAddressController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_getStateDepositHolderAddress)
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
    const address = await store.getMultisigAddressWithCounterparty(
      owners,
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider!,
    );

    return { address };
  }
}
