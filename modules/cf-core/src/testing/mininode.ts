import {
  AppInstanceProposal,
  EthereumCommitment,
  NetworkContext,
  nullLogger,
  IStoreService,
} from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";
import { HDNode } from "ethers/utils/hdnode";
import { signDigest } from "@connext/crypto";

import { Opcode, PersistAppType } from "../types";
import { ProtocolRunner } from "../machine";
import { AppInstance, StateChannel } from "../models";

import { getRandomHDNodes } from "./random-signing-keys";

/// Returns a function that can be registered with IO_SEND{_AND_WAIT}
const makeSigner = (hdNode: HDNode) => {
  return async (args: [EthereumCommitment] | [EthereumCommitment, number]) => {
    if (args.length !== 1 && args.length !== 2) {
      throw new Error("OP_SIGN middleware received wrong number of arguments.");
    }

    const [commitment, overrideKeyIndex] = args;
    const keyIndex = overrideKeyIndex || 0;

    const privateKey = hdNode.derivePath(`${keyIndex}`).privateKey;
    const hash = commitment.hashToSign();

    return await signDigest(privateKey, hash);
  };
};

export class MiniNode {
  private readonly hdNode: HDNode;
  public readonly protocolRunner: ProtocolRunner;
  public scm: Map<string, StateChannel>;
  public readonly xpub: string;

  constructor(
    readonly networkContext: NetworkContext,
    readonly provider: JsonRpcProvider,
    readonly store: IStoreService,
  ) {
    [this.hdNode] = getRandomHDNodes(1);
    this.xpub = this.hdNode.neuter().extendedKey;
    this.protocolRunner = new ProtocolRunner(networkContext, provider, store, nullLogger);
    this.scm = new Map<string, StateChannel>();
    this.protocolRunner.register(Opcode.OP_SIGN, makeSigner(this.hdNode));
    this.protocolRunner.register(Opcode.PERSIST_COMMITMENT, () => {});
    this.protocolRunner.register(Opcode.PERSIST_STATE_CHANNEL, async (args: [StateChannel[]]) => {
      const [stateChannels] = args;
      for (const stateChannel of stateChannels) {
        await this.store.createStateChannel(stateChannel.toJson());
        await this.store.createFreeBalance(
          stateChannel.multisigAddress,
          stateChannel.freeBalance.toJson(),
        );
      }
    });
    this.protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (args: [PersistAppType, StateChannel, AppInstance | AppInstanceProposal]) => {
        const [type, postProtocolChannel, app] = args;

        const { multisigAddress, numProposedApps, freeBalance } = postProtocolChannel;

        switch (type) {
          case PersistAppType.CreateProposal: {
            await this.store.createAppProposal(
              multisigAddress,
              app as AppInstanceProposal,
              numProposedApps,
            );
            break;
          }

          case PersistAppType.Reject: {
            await this.store.removeAppProposal(
              multisigAddress,
              (app as AppInstanceProposal).identityHash,
            );
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
            await this.store.removeAppInstance(
              multisigAddress,
              app.identityHash,
              freeBalance.toJson(),
            );
            break;
          }

          default:
            throw new Error(`Unrecognized app persistence call: ${type}`);
        }
      },
    );
  }

  public async dispatchMessage(message: any) {
    await this.protocolRunner.runProtocolWithMessage(message);
  }
}
