import {
  AppIdentity,
  MultisigOperation,
  MultisigTransaction,
  ContractAddresses,
} from "@connext/types";
import { utils } from "ethers";
import { appIdentityToHash } from "@connext/utils";

import * as ConditionalTransactionDelegateTarget from "../../artifacts/ConditionalTransactionDelegateTarget.json";

import { MultisigCommitment } from "./multisig-commitment";

const { Interface } = utils;

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

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
      data: iface.encodeFunctionData("executeEffectOfFreeBalance", [
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
