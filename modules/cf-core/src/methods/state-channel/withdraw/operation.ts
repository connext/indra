import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import {
  Protocol,
  WithdrawParams,
} from "../../../types";

export async function runWithdrawProtocol(
  requestHandler: RequestHandler,
  params: WithdrawParams,
) {
  const { publicIdentifier, protocolRunner, store } = requestHandler;
  const { multisigAddress, amount } = params;

  const tokenAddress = params.tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

  const [peerAddress] = await StateChannel.getPeersAddressFromChannel(
    publicIdentifier,
    store,
    multisigAddress,
  );

  const stateChannel = await store.getStateChannel(multisigAddress);

  await protocolRunner.initiateProtocol(Protocol.Withdraw, {
    amount,
    tokenAddress,
    recipient: params.recipient as string,
    initiatorXpub: publicIdentifier,
    responderXpub: peerAddress,
    multisigAddress: stateChannel.multisigAddress,
  });
}
