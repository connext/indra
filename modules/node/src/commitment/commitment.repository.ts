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
import { AppInstance } from "../appInstance/appInstance.entity";
import { Channel } from "../channel/channel.entity";
import { bigNumberify } from "ethers/utils";

function convertWithdrawToMinimalTransaction(commitment: WithdrawCommitment) {
  return {
    to: commitment.to,
    value: commitment.value,
    data: commitment.data,
  };
}

@EntityRepository(WithdrawCommitment)
export class WithdrawCommitmentRepository extends Repository<WithdrawCommitment> {
  // TODO: assumes there will only be one withdrawal commitment per multisig
  findByMultisigAddress(multisigAddress: string): Promise<WithdrawCommitment> {
    return this.createQueryBuilder("withdraw")
      .leftJoinAndSelect("withdraw.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getOne();
  }

  async getWithdrawalCommitmentTx(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction> {
    const withdrawal = await this.findByMultisigAddress(multisigAddress);
    if (!withdrawal) {
      return undefined;
    }
    return convertWithdrawToMinimalTransaction(withdrawal);
  }

  async saveWithdrawalCommitment(
    channel: Channel,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    let commitmentEnt = await this.findByMultisigAddress(channel.multisigAddress);
    if (!commitmentEnt) {
      commitmentEnt = new WithdrawCommitment();
      commitmentEnt.type = CommitmentType.WITHDRAWAL;
      commitmentEnt.channel = channel;
    }
    commitmentEnt.to = commitment.to;
    commitmentEnt.value = bigNumberify(commitment.value);
    commitmentEnt.data = commitment.data;
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
    return this.createQueryBuilder("conditional")
      .leftJoinAndSelect("conditional.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
  }

  findByMultisigAddress(
    multisigAddress: string,
  ): Promise<ConditionalTransactionCommitmentEntity[]> {
    return this.find({
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
    return {
      appIdentityHash,
      freeBalanceAppIdentityHash: commitment.freeBalanceAppIdentityHash,
      interpreterAddr: commitment.interpreterAddr,
      interpreterParams: commitment.interpreterParams,
      multisigAddress: commitment.multisigAddress,
      multisigOwners: commitment.multisigOwners,
      networkContext: commitment.networkContext,
      signatures: commitment.signatures,
    };
  }

  async saveConditionalTransactionCommitment(
    app: AppInstance,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    let commitmentEntity = await this.findByAppIdentityHash(app.identityHash);
    if (!commitmentEntity) {
      commitmentEntity = new ConditionalTransactionCommitmentEntity();
      commitmentEntity.type = CommitmentType.CONDITIONAL;
      commitmentEntity.app = app;
      commitmentEntity.freeBalanceAppIdentityHash = commitment.freeBalanceAppIdentityHash;
      commitmentEntity.multisigAddress = commitment.multisigAddress;
      commitmentEntity.multisigOwners = commitment.multisigOwners;
      const { provider, ...networkContext } = commitment.networkContext;
      commitmentEntity.networkContext = networkContext;
      commitmentEntity.interpreterAddr = commitment.interpreterAddr;
    }
    commitmentEntity.interpreterParams = commitment.interpreterParams;
    commitmentEntity.signatures = commitment.signatures;
    await this.save(commitmentEntity);
  }
}

export const setStateToJson = (entity: SetStateCommitmentEntity): SetStateCommitmentJSON => {
  return {
    appIdentity: entity.appIdentity as any,
    appIdentityHash: entity.app.identityHash,
    appStateHash: entity.appStateHash,
    challengeRegistryAddress: entity.challengeRegistryAddress,
    signatures: entity.signatures as any,
    timeout: entity.timeout,
    versionNumber: entity.versionNumber,
  };
};

@EntityRepository(SetStateCommitmentEntity)
export class SetStateCommitmentRepository extends Repository<SetStateCommitmentEntity> {
  findByAppIdentityHash(appIdentityHash: string): Promise<SetStateCommitmentEntity | undefined> {
    return this.createQueryBuilder("set_state")
      .leftJoinAndSelect("set_state.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
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
    return setStateToJson(commitment);
  }

  async saveLatestSetStateCommitment(
    app: AppInstance,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    let entity = await this.findByAppIdentityHash(app.identityHash);
    if (!entity) {
      entity = new SetStateCommitmentEntity();
      entity.type = CommitmentType.SET_STATE;
      entity.app = app;
      entity.appIdentity = commitment.appIdentity;
    }
    entity.appStateHash = commitment.appStateHash;
    entity.challengeRegistryAddress = commitment.challengeRegistryAddress;
    entity.signatures = commitment.signatures;
    entity.timeout = commitment.timeout;
    entity.versionNumber = commitment.versionNumber;
    this.save(entity);
  }
}
