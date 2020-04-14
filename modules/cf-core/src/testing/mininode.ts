import {
  AppInstanceProposal,
  IChannelSigner,
  IStoreService,
  NetworkContext,
  Opcode,
  PublicIdentifier,
} from "@connext/types";
import { getRandomChannelSigner, nullLogger } from "@connext/utils";
import { JsonRpcProvider } from "ethers/providers";

import { ProtocolRunner } from "../machine";
import { AppInstance, StateChannel } from "../models";
import { PersistAppType } from "../types";

/// Returns a function that can be registered with IO_SEND{_AND_WAIT}
const makeSigner = (signer: IChannelSigner) => {
  return async (args: any[]) => {
    if (args.length !== 1) {
      throw new Error("OP_SIGN middleware received wrong number of arguments.");
    }

    const [commitmentHash] = args;
    return signer.signMessage(commitmentHash);
  };
};

export class MiniNode {
  private readonly signer: IChannelSigner;
  public readonly protocolRunner: ProtocolRunner;
  public scm: Map<string, StateChannel>;
  public readonly address: string;
  public readonly publicIdentifier: PublicIdentifier;

  constructor(
    readonly networkContext: NetworkContext,
    readonly provider: JsonRpcProvider,
    readonly store: IStoreService,
  ) {
    this.signer = getRandomChannelSigner();
    this.publicIdentifier = this.signer.publicIdentifier;
    this.address = this.signer.address;
    this.protocolRunner = new ProtocolRunner(
      networkContext, 
      provider, 
      store,
      nullLogger,
    );
    this.scm = new Map<string, StateChannel>();
    this.protocolRunner.register(Opcode.OP_SIGN, makeSigner(this.signer));
    this.protocolRunner.register(Opcode.PERSIST_COMMITMENT, () => {});
    this.protocolRunner.register(Opcode.PERSIST_STATE_CHANNEL, async (args: [StateChannel[]]) => {
      const [stateChannels] = args;
      for (const stateChannel of stateChannels) {
        await this.store.createStateChannel(stateChannel.toJson());
      }
    });
    this.protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (args: [PersistAppType, StateChannel, AppInstance | AppInstanceProposal]) => {
        const [type, postProtocolChannel, app] = args;
        const { multisigAddress, numProposedApps, freeBalance } = postProtocolChannel;
        const { identityHash } = app;

        switch (type) {
          case PersistAppType.CreateProposal: {
            await this.store.createAppProposal(
              multisigAddress,
              app as AppInstanceProposal,
              numProposedApps,
            );
            break;
          }

          case PersistAppType.RemoveProposal: {
            await this.store.removeAppProposal(multisigAddress, identityHash);
            break;
          }

          case PersistAppType.CreateInstance: {
            await this.store.createAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
              freeBalance.toJson(),
            );
            break;
          }

          case PersistAppType.UpdateInstance: {
            await this.store.updateAppInstance(multisigAddress, (app as AppInstance).toJson());
            break;
          }

          case PersistAppType.RemoveInstance: {
            await this.store.removeAppInstance(multisigAddress, identityHash, freeBalance.toJson());
            break;
          }

          case PersistAppType.Reject: {
            await this.store.removeAppProposal(multisigAddress, identityHash);
            break;
          }

          default: {
            throw new Error(`Unrecognized app persistence call: ${type}`);
          }
        }
      },
    );
  }

  public async dispatchMessage(message: any) {
    await this.protocolRunner.runProtocolWithMessage(message);
  }
}
