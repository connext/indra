import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { CFCoreTypes } from "../../../types";
import { getCreate2MultisigAddress } from "../../../utils";
import { NodeController } from "../../controller";
import { NO_NETWORK_PROVIDER_CREATE2 } from "../../errors";

export default class GetStateDepositHolderAddressController extends NodeController {
  @jsonRpcMethod(CFCoreTypes.RpcMethodNames.chan_getStateDepositHolderAddress)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.GetStateDepositHolderAddressParams
  ): Promise<CFCoreTypes.GetStateDepositHolderAddressResult> {
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
      networkContext.provider!
    );

    return { address };
  }
}
