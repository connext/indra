import { MessagingConfig } from "@connext/messaging";
import { NetworkContext, Node as CFCoreTypes } from "@connext/cf-types";
import { BigNumber, Network } from "ethers/utils";

import { CFCoreChannel } from "./channel";

////////////////////////////////////
///////// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: string;
  [KnownNodeApp: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

export type Transfer<T = string> = {
  id: number;
  amount: T;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier: string;
};
export type TransferBigNumber = Transfer<BigNumber>;

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

export type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

export type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: string;
  messaging: MessagingConfig;
};

export type GetChannelResponse = CFCoreChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

export type RequestCollateralResponse = CFCoreTypes.DepositResult | undefined;
