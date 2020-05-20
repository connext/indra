import {
  AppIdentity,
  MultisigOperation,
  MultisigTransaction,
  ContractAddresses,
} from "@connext/types";
import { Interface } from "ethers/utils";
import { appIdentityToHash } from "@connext/utils";

import * as ConditionalTransactionDelegateTarget from "../build/ConditionalTransactionDelegateTarget.json";


import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi as any);

export class SetupCommitment extends MultisigCommitment {
  public constructor(
    public readonly contractAddresses: ContractAddresses,
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly freeBalanceAppIdentity: AppIdentity,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      data: iface.functions.executeEffectOfFreeBalance.encode([
        this.contractAddresses.ChallengeRegistry,
        appIdentityToHash(this.freeBalanceAppIdentity),
        this.contractAddresses.MultiAssetMultiPartyCoinTransferInterpreter,
      ]),
      operation: MultisigOperation.DelegateCall,
      to: this.contractAddresses.ConditionalTransactionDelegateTarget,
      value: 0,
    };
  }
}
