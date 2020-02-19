import { CHALLENGE_INITIATED_EVENT, ChallengeInitiatedMessage } from "@connext/types";
import { jsonRpcMethod } from "rpc-server";

import { NodeController } from "../../controller";
import { CFCoreTypes, ProtocolTypes } from "../../../types";
import { RequestHandler } from "../../../request-handler";
import {
  // CHALLENGE_PERIOD_ELAPSED,
  // INCORRECT_CHALLENGE_STATUS,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
  INCORRECT_MULTISIG_ADDRESS,
} from "../../errors";
import { getCreate2MultisigAddress } from "../../../utils";

import { submitSetState } from "./operation";
import { StateChannel } from "../../../models";

export default class SetStateController extends NodeController {
  @jsonRpcMethod(ProtocolTypes.chan_setState)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: CFCoreTypes.MethodParams,
  ) => Promise<CFCoreTypes.MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: CFCoreTypes.SetStateParams,
  ): Promise<string[]> {
    // no need to queue on the app or the multisig
    // TODO: make sure that you are not updating
    // any apps that are being actively disputed
    return [];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: CFCoreTypes.SetStateParams,
  ): Promise<void> {
    const { provider, store } = requestHandler;
    const { appInstanceId } = params;

    const channel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!channel.addresses.proxyFactory) {
      throw Error(INVALID_FACTORY_ADDRESS(channel.addresses.proxyFactory));
    }

    if (!channel.addresses.multisigMastercopy) {
      throw Error(INVALID_MASTERCOPY_ADDRESS(channel.addresses.multisigMastercopy));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userNeuteredExtendedKeys,
      channel.addresses,
      provider,
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw Error(INCORRECT_MULTISIG_ADDRESS);
    }

    // TODO: figure out how to store challenges -- in its own key or in
    // the `channel/` namespace
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: CFCoreTypes.SetStateParams,
  ): Promise<CFCoreTypes.SetStateResult> {
    const { messagingService, outgoing, publicIdentifier, store } = requestHandler;
    const { appInstanceId } = params;
    const channel = await store.getChannelFromAppInstanceID(appInstanceId);
    const [counterpartyAddress] = await StateChannel.getPeersAddressFromChannel(
      publicIdentifier,
      store,
      channel.multisigAddress,
    );

    const txHash = await submitSetState(requestHandler, params);

    const payload: ChallengeInitiatedMessage = {
      from: publicIdentifier,
      type: CHALLENGE_INITIATED_EVENT,
      data: { params, txHash },
    };

    await messagingService.send(counterpartyAddress, payload);
    outgoing.emit(CHALLENGE_INITIATED_EVENT, payload);

    return {
      txHash,
    };
  }
}
