import {
  getAddress,
  Interface,
  keccak256,
  solidityKeccak256,
  solidityPack
} from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { MinimumViableMultisig } from "../../../contracts";
import { xkeysToSortedKthAddresses } from "../../../machine";
import { RequestHandler } from "../../../request-handler";
import { Node } from "../../../types";
import { getCreate2MultisigAddress } from "../../../utils";
import { NodeController } from "../../controller";

export default class GetStateDepositHolderAddressController extends NodeController {
  @jsonRpcMethod(Node.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS)
  public executeMethod = super.executeMethod;

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetStateDepositHolderAddressParams
  ): Promise<Node.GetStateDepositHolderAddressResult> {
    const { owners } = params;
    const { networkContext } = requestHandler;
    if (!networkContext.provider) {
      throw new Error(
        `getCreate2MultisigAddress needs access to an eth provider`
      );
    }
    const address = await getCreate2MultisigAddress(
      owners,
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider
    );
    return { address };
  }
}
