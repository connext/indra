import { BaseProvider } from "ethers/providers";

import { StateChannel } from "../models";
import {
  NetworkContext,
  ProtocolMessage,
  SolidityValueType,
} from "../types";

import { Opcode } from "./enums";

export {
  ProtocolMessage,
  ProtocolParameters,
  InstallProtocolParams,
  InstallVirtualAppProtocolParams,
  ProposeInstallProtocolParams,
  SetupProtocolParams,
  UninstallProtocolParams,
  UninstallVirtualAppProtocolParams,
  UpdateProtocolParams,
  WithdrawProtocolParams,
} from "../types";

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

/// Arguments passed to a protocol execulion flow
export interface Context {
  network: NetworkContext;
  stateChannelsMap: Map<string, StateChannel>;
  message: ProtocolMessage;
  provider: BaseProvider;
}

export type TakeActionProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  action: SolidityValueType;
};
