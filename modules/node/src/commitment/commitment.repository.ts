import { EntityRepository, Repository } from "typeorm";
import {
  CommitmentType,
  SetStateCommitmentEntity,
  ConditionalTransactionCommitmentEntity,
  WithdrawCommitment,
} from "./commitment.entity";
import {
  ConditionalTransactionCommitmentJSON,
  ProtocolTypes,
  SetStateCommitmentJSON,
} from "@connext/types";

@EntityRepository(WithdrawCommitment)
export class WithdrawCommitmentRepository extends Repository<WithdrawCommitment> {
  findByMultisigAddress(multisigAddress: string): Promise<WithdrawCommitment> {
    return this.findOne({
      where: {
        multisigAddress,
      },
    });
  }

  findByCommitmentHash(commitmentHash: string): Promise<WithdrawCommitment> {
    return this.findOne({
      where: {
        commitmentHash,
      },
    });
  }

  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction> {
    const commitment = await this.findByMultisigAddress(multisigAddress);
    if (!commitment) {
      return undefined;
    }

    return commitment.data as ProtocolTypes.MinimalTransaction;
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    const commitmentEnt = new WithdrawCommitment();
    commitmentEnt.type = CommitmentType.WITHDRAWAL;
    commitmentEnt.multisigAddress = multisigAddress;
    commitmentEnt.data = commitment;
    this.save(commitmentEnt);
  }
}

@EntityRepository(ConditionalTransactionCommitmentEntity)
export class ConditionalTransactionCommitmentRepository extends Repository<
  ConditionalTransactionCommitmentEntity
> {
  findByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentEntity | undefined> {
    return this.findOne({
      where: {
        appIdentityHash,
      },
    });
  }

  findByMultisigAddress(
    multisigAddress: string,
  ): Promise<ConditionalTransactionCommitmentEntity | undefined> {
    return this.findOne({
      where: {
        multisigAddress,
      },
    });
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const commitment = await this.findByAppIdentityHash(appIdentityHash);
    if (!commitment) {
      return undefined;
    }
    return commitment as ConditionalTransactionCommitmentJSON;
  }

  async saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const commitmentEntity = new ConditionalTransactionCommitmentEntity();
    commitmentEntity.type = CommitmentType.CONDITIONAL;
    commitmentEntity.appIdentityHash = appIdentityHash;
    commitmentEntity.freeBalanceAppIdentityHash = commitment.freeBalanceAppIdentityHash;
    commitmentEntity.interpreterAddr = commitment.interpreterAddr;
    commitmentEntity.interpreterParams = commitment.interpreterParams;
    commitmentEntity.multisigAddress = commitment.multisigAddress;
    commitmentEntity.multisigOwners = commitment.multisigOwners;
    commitmentEntity.networkContext = commitment.networkContext;
    commitmentEntity.signatures = commitment.signatures;
    this.save(commitmentEntity);
  }
}

@EntityRepository(SetStateCommitmentEntity)
export class SetStateCommitmentRepository extends Repository<SetStateCommitmentEntity> {
  findByAppIdentityHash(appIdentityHash: string): Promise<SetStateCommitmentEntity | undefined> {
    return this.findOne({
      where: {
        appIdentityHash,
      },
    });
  }

  findByAppStateHash(appStateHash: string): Promise<SetStateCommitmentEntity | undefined> {
    return this.findOne({
      where: {
        appStateHash,
      },
    });
  }

  async getLatestSetStateCommitment(
    appIdentityHash: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    const commitment = await this.findByAppIdentityHash(appIdentityHash);
    if (!commitment) {
      return undefined;
    }
    return commitment as SetStateCommitmentJSON;
  }

  async saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const commitmentEntity = new SetStateCommitmentEntity();
    commitmentEntity.type = CommitmentType.SET_STATE;
    commitmentEntity.appIdentityHash = appIdentityHash;
    commitmentEntity.appIdentity = commitment.appIdentity;
    commitmentEntity.appStateHash = commitment.appStateHash;
    commitmentEntity.challengeRegistryAddress = commitment.challengeRegistryAddress;
    commitmentEntity.signatures = commitment.signatures;
    commitmentEntity.timeout = commitment.timeout;
    commitmentEntity.versionNumber = commitment.versionNumber;
    this.save(commitmentEntity);
  }
}
