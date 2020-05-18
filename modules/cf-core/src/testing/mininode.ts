import {
  AppInstanceProposal,
  IChannelSigner,
  IStoreService,
  NetworkContext,
  Opcode,
  PublicIdentifier,
  MinimalTransaction,
  STORE_SCHEMA_VERSION,
} from "@connext/types";
import { getRandomChannelSigner, nullLogger } from "@connext/utils";
import { providers } from "ethers";

import { ProtocolRunner } from "../machine";
import { AppInstance, StateChannel } from "../models";
import { PersistAppType, PersistStateChannelType } from "../types";
import { SetStateCommitment, ConditionalTransactionCommitment } from "../ethereum";

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
    readonly provider: providers.JsonRpcProvider,
    readonly store: IStoreService,
  ) {
    this.signer = getRandomChannelSigner();
    this.publicIdentifier = this.signer.publicIdentifier;
    this.address = this.signer.address;
    this.protocolRunner = new ProtocolRunner(networkContext, provider, store, nullLogger);
    this.scm = new Map<string, StateChannel>();
    this.protocolRunner.register(Opcode.OP_SIGN, makeSigner(this.signer));
    this.protocolRunner.register(
      Opcode.PERSIST_STATE_CHANNEL,
      async (
        args: [
          PersistStateChannelType,
          StateChannel,
          (MinimalTransaction | SetStateCommitment | ConditionalTransactionCommitment)[],
        ],
      ) => {
        const [type, stateChannel, signedCommitments] = args;
        switch (type) {
          case PersistStateChannelType.CreateChannel: {
            const [setup, freeBalance] = signedCommitments as [
              MinimalTransaction,
              SetStateCommitment,
            ];
            await this.store.createStateChannel(stateChannel.toJson(), setup, freeBalance.toJson());

            await this.store.updateSchemaVersion(STORE_SCHEMA_VERSION);
            break;
          }

          case PersistStateChannelType.SyncProposal: {
            const [setState] = signedCommitments as [SetStateCommitment];
            const proposal = stateChannel.proposedAppInstances.get(setState.appIdentityHash);
            if (!proposal) {
              throw new Error("Could not find proposal in post protocol channel");
            }
            // this is adding a proposal
            await this.store.createAppProposal(
              stateChannel.multisigAddress,
              proposal,
              stateChannel.numProposedApps,
              setState.toJson(),
            );
            break;
          }
          case PersistStateChannelType.NoChange: {
            break;
          }
          case PersistStateChannelType.SyncFreeBalance: {
            const [setState, conditional] = signedCommitments as [
              SetStateCommitment,
              ConditionalTransactionCommitment | undefined,
            ];
            if (!conditional) {
              // this was an uninstall, so remove app instance
              await this.store.removeAppInstance(
                stateChannel.multisigAddress,
                setState.appIdentityHash,
                stateChannel.freeBalance.toJson(),
                setState.toJson(),
              );
            } else {
              // this was an install, add app and remove proposals
              await this.store.createAppInstance(
                stateChannel.multisigAddress,
                stateChannel.getAppInstanceByAppSeqNo(setState.versionNumber.toNumber()).toJson(),
                stateChannel.freeBalance.toJson(),
                setState.toJson(),
                conditional.toJson(),
              );
            }
            break;
          }
          case PersistStateChannelType.SyncAppInstances: {
            for (const commitment of signedCommitments as SetStateCommitment[]) {
              await this.store.updateAppInstance(
                stateChannel.multisigAddress,
                stateChannel.appInstances.get(commitment.appIdentityHash)!.toJson(),
                commitment.toJson(),
              );
            }
            break;
          }
          default: {
            throw new Error(`Unrecognized persist state channel type: ${type}`);
          }
        }
        return { channel: stateChannel };
      },
    );
    this.protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (
        args: [
          PersistAppType,
          StateChannel,
          AppInstance | AppInstanceProposal,
          SetStateCommitment,
          ConditionalTransactionCommitment,
        ],
      ) => {
        const [
          type,
          postProtocolChannel,
          app,
          signedSetStateCommitment,
          signedConditionalTxCommitment,
        ] = args;
        const { multisigAddress, numProposedApps, freeBalance } = postProtocolChannel;
        const { identityHash } = app;

        switch (type) {
          case PersistAppType.CreateProposal: {
            await this.store.createAppProposal(
              multisigAddress,
              app as AppInstanceProposal,
              numProposedApps,
              signedSetStateCommitment.toJson(),
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
              signedSetStateCommitment.toJson(),
              signedConditionalTxCommitment.toJson(),
            );
            break;
          }

          case PersistAppType.UpdateInstance: {
            await this.store.updateAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
              signedSetStateCommitment.toJson(),
            );
            break;
          }

          case PersistAppType.RemoveInstance: {
            await this.store.removeAppInstance(
              multisigAddress,
              identityHash,
              freeBalance.toJson(),
              signedSetStateCommitment.toJson(),
            );
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

        return { channel: postProtocolChannel };
      },
    );
  }

  public async dispatchMessage(message: any) {
    await this.protocolRunner.runProtocolWithMessage(message);
  }
}
