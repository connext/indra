import { NetworkContext, nullLogger, PersistAppType, AppInstanceProposal } from "@connext/types";
import { JsonRpcProvider } from "ethers/providers";
import { SigningKey } from "ethers/utils";
import { HDNode } from "ethers/utils/hdnode";

import { EthereumCommitment } from "../../../src/types";
import { Opcode, ProtocolRunner } from "../../../src/machine";
import { StateChannel, AppInstance } from "../../../src/models";
import { Store } from "../../../src/store";

import { getRandomHDNodes } from "./random-signing-keys";

/// Returns a function that can be registered with IO_SEND{_AND_WAIT}
const makeSigner = (hdNode: HDNode) => {
  return async (args: [EthereumCommitment] | [EthereumCommitment, number]) => {
    if (args.length !== 1 && args.length !== 2) {
      throw Error("OP_SIGN middleware received wrong number of arguments.");
    }

    const [commitment, overrideKeyIndex] = args;
    const keyIndex = overrideKeyIndex || 0;

    const signingKey = new SigningKey(hdNode.derivePath(`${keyIndex}`).privateKey);

    return signingKey.signDigest(commitment.hashToSign());
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
    readonly store: Store,
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
        await this.store.saveStateChannel(stateChannel);
      }
    });
    this.protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (args: [PersistAppType, StateChannel, AppInstance | AppInstanceProposal]) => {
        const [type, postProtocolChannel, app] = args;

        // always persist the free balance
        // this will error if channel does not exist
        await this.store.saveFreeBalance(postProtocolChannel);

        switch (type) {
          case PersistAppType.Proposal:
            await this.store.saveAppProposal(postProtocolChannel, app as AppInstanceProposal);
            break;
          case PersistAppType.Reject:
            await this.store.removeAppProposal(postProtocolChannel, app as AppInstanceProposal);
            break;

          case PersistAppType.Instance:
            if (app.identityHash === postProtocolChannel.freeBalance.identityHash) {
              break;
            }
            await this.store.saveAppInstance(postProtocolChannel, app as AppInstance);
            break;

          case PersistAppType.Uninstall:
            await this.store.removeAppInstance(postProtocolChannel, app as AppInstance);
            break;

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
