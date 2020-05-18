import {
  AppIdentity,
  MultisigOperation,
  MultisigTransaction,
  NetworkContext,
} from "@connext/types";
import { utils } from "ethers";
import { appIdentityToHash } from "@connext/utils";

import * as ConditionalTransactionDelegateTarget from "../build/ConditionalTransactionDelegateTarget.json";
import { MultisigCommitment } from "./multisig-commitment";

const { Interface } = utils;

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

export class SetupCommitment extends MultisigCommitment {
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
      data: iface.encodeFunctionData("executeEffectOfFreeBalance", [
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
