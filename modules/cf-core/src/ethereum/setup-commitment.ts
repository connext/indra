import { Interface } from "ethers/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { StateChannel } from "../models";
import {
  AppIdentity,
  Context,
  MultisigOperation,
  MultisigTransaction,
  NetworkContext,
} from "../types";
import { appIdentityToHash } from "../utils";

import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

export const getSetupCommitment = (context: Context, stateChannel: StateChannel): SetupCommitment =>
  new SetupCommitment(
    context.network,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    stateChannel.freeBalance.identity,
  );

class SetupCommitment extends MultisigCommitment {
  public constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly freeBalanceAppIdentity: AppIdentity,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      data: iface.functions.executeEffectOfFreeBalance.encode([
        this.networkContext.ChallengeRegistry,
        appIdentityToHash(this.freeBalanceAppIdentity),
        this.networkContext.MultiAssetMultiPartyCoinTransferInterpreter,
      ]),
      operation: MultisigOperation.DelegateCall,
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
    };
  }
}
