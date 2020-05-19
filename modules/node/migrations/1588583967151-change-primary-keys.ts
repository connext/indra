import { MigrationInterface, QueryRunner } from "typeorm";

export class changePrimaryKeys1588583967151 implements MigrationInterface {
  name = "changePrimaryKeys1588583967151";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP CONSTRAINT "FK_9c7a599292fa0a06669750e9425"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP CONSTRAINT "FK_9f5b32d06d63e60256bca71bb42"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_f61a56ed1169fe59fd019cf284e"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_0fa6c5f8f54fc3b5f94bd80fe3c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "FK_81bcbad53a3d766cc635e94baf5"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "FK_6eb316c0bb4a9307a8bb1ae77b6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP CONSTRAINT "FK_819d296d9860dbfa2e553018272"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_a6e241f5665c326b3e201d84253"`,
      undefined,
    );
    await queryRunner.query(`DROP INDEX "IDX_a6e241f5665c326b3e201d8425"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" RENAME COLUMN "channelId" TO "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" RENAME COLUMN "channelId" TO "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" RENAME COLUMN "channelId" TO "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" RENAME CONSTRAINT "REL_9f5b32d06d63e60256bca71bb4" TO "UQ_18be0160c5e4379400d8ab04e5c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" RENAME COLUMN "appId" TO "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" RENAME CONSTRAINT "REL_81bcbad53a3d766cc635e94baf" TO "UQ_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" RENAME COLUMN "appId" TO "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" RENAME COLUMN "channelId" TO "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD COLUMN "channelMultisigAddress" text`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "channel_rebalance_profiles_rebalance_profile" 
      SET "channelMultisigAddress" = "channel"."multisigAddress"
      FROM "channel" 
      WHERE "channel"."id" = "channel_rebalance_profiles_rebalance_profile"."channelId"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "id" CASCADE`, undefined);
    await queryRunner.query(`ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP COLUMN "channelId" CASCADE`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff765cc"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "id"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "channelId"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "REL_0fa6c5f8f54fc3b5f94bd80fe3"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "challenge" DROP COLUMN "appId"`, undefined);
    await queryRunner.query(`ALTER TABLE "challenge" DROP COLUMN "channelId"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD "channelMultisigAddress" text`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "challenge" ADD "appIdentityHash" text`, undefined);
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "UQ_f296f6a5899c0e64c372fe0437b" UNIQUE ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "challenge" ADD "channelMultisigAddress" text`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "channelMultisigAddress" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD "channelMultisigAddress" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP CONSTRAINT "UQ_18be0160c5e4379400d8ab04e5c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD "channelMultisigAddress" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD CONSTRAINT "UQ_18be0160c5e4379400d8ab04e5c" UNIQUE ("channelMultisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD CONSTRAINT "PK_b0e29ab6bff34fb58e8fb63dd48" PRIMARY KEY ("multisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "PK_52351d5f79e9c41c711625e4ea7" PRIMARY KEY ("identityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "UQ_52351d5f79e9c41c711625e4ea7"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "defaultTimeout" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "UQ_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "appIdentityHash" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "UQ_e0e92322fb954102944db1889c6" UNIQUE ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP COLUMN "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "appIdentityHash" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "UQ_7ea341dca81a2105ce9f6d2d83d" UNIQUE ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "withdraw" ADD "channelMultisigAddress" text`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "PK_26fcccb4dfc210a7aa00e9fecd0" PRIMARY KEY ("rebalanceProfileId")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ALTER COLUMN "channelMultisigAddress" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "PK_26fcccb4dfc210a7aa00e9fecd0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "PK_ff1214c26e38aac20d9c4becc67" PRIMARY KEY ("rebalanceProfileId", "channelMultisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b3a89693bd2ec6def5cea07794" ON "channel_rebalance_profiles_rebalance_profile" ("channelMultisigAddress") `,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD CONSTRAINT "FK_081f23f407f3bacfe8953996b1a" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD CONSTRAINT "FK_7be8ddc351c58ce510e6cd29ddc" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD CONSTRAINT "FK_18be0160c5e4379400d8ab04e5c" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "FK_5e278b76f8828f6a859db644d00" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_f296f6a5899c0e64c372fe0437b" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_d147f5f97f4d102cf4ce11207e8" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "FK_e0e92322fb954102944db1889c6" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" ADD CONSTRAINT "FK_be1d5b1653fa9639033960912e8" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_b3a89693bd2ec6def5cea077945" FOREIGN KEY ("channelMultisigAddress") REFERENCES "channel"("multisigAddress") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_b3a89693bd2ec6def5cea077945"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP CONSTRAINT "FK_be1d5b1653fa9639033960912e8"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "FK_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_d147f5f97f4d102cf4ce11207e8"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_f296f6a5899c0e64c372fe0437b"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "FK_5e278b76f8828f6a859db644d00"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP CONSTRAINT "FK_18be0160c5e4379400d8ab04e5c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP CONSTRAINT "FK_7be8ddc351c58ce510e6cd29ddc"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP CONSTRAINT "FK_081f23f407f3bacfe8953996b1a"`,
      undefined,
    );
    await queryRunner.query(`DROP INDEX "IDX_b3a89693bd2ec6def5cea07794"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "PK_ff1214c26e38aac20d9c4becc67"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "PK_26fcccb4dfc210a7aa00e9fecd0" PRIMARY KEY ("rebalanceProfileId")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD "channelMultisigAddress" integer NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "PK_26fcccb4dfc210a7aa00e9fecd0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "PK_ff1214c26e38aac20d9c4becc67" PRIMARY KEY ("channelMultisigAddress", "rebalanceProfileId")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" ADD "channelMultisigAddress" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "UQ_7ea341dca81a2105ce9f6d2d83d"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP COLUMN "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "appIdentityHash" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "UQ_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "appIdentityHash"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "appIdentityHash" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "UQ_e0e92322fb954102944db1889c6" UNIQUE ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "defaultTimeout" SET DEFAULT '0x0'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "UQ_52351d5f79e9c41c711625e4ea7" UNIQUE ("identityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "PK_52351d5f79e9c41c711625e4ea7"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48" UNIQUE ("multisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "PK_b0e29ab6bff34fb58e8fb63dd48"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP CONSTRAINT "UQ_18be0160c5e4379400d8ab04e5c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD "channelMultisigAddress" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD CONSTRAINT "UQ_18be0160c5e4379400d8ab04e5c" UNIQUE ("channelMultisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD "channelMultisigAddress" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "channelMultisigAddress" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "UQ_f296f6a5899c0e64c372fe0437b"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "challenge" DROP COLUMN "appIdentityHash"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP COLUMN "channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "challenge" ADD "channelId" integer`, undefined);
    await queryRunner.query(`ALTER TABLE "challenge" ADD "appId" integer`, undefined);
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "REL_0fa6c5f8f54fc3b5f94bd80fe3" UNIQUE ("appId")`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "channelId" integer`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "id" SERIAL NOT NULL`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff765cc" PRIMARY KEY ("id")`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" ADD "id" SERIAL NOT NULL`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel" ADD CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" RENAME CONSTRAINT "PK_ff1214c26e38aac20d9c4becc67" TO "PK_9c2ccb5c8ad188c607741998905"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" RENAME COLUMN "channelMultisigAddress" TO "channelId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" RENAME COLUMN "channelMultisigAddress" TO "channelId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" RENAME COLUMN "appIdentityHash" TO "appId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" RENAME CONSTRAINT "UQ_e0e92322fb954102944db1889c6" TO "REL_81bcbad53a3d766cc635e94baf"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" RENAME COLUMN "appIdentityHash" TO "appId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" RENAME CONSTRAINT "UQ_18be0160c5e4379400d8ab04e5c" TO "REL_9f5b32d06d63e60256bca71bb4"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" RENAME COLUMN "channelMultisigAddress" TO "channelId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" RENAME COLUMN "channelMultisigAddress" TO "channelId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" RENAME COLUMN "channelMultisigAddress" TO "channelId"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a6e241f5665c326b3e201d8425" ON "channel_rebalance_profiles_rebalance_profile" ("channelId") `,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_a6e241f5665c326b3e201d84253" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" ADD CONSTRAINT "FK_819d296d9860dbfa2e553018272" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "FK_6eb316c0bb4a9307a8bb1ae77b6" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "FK_81bcbad53a3d766cc635e94baf5" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_0fa6c5f8f54fc3b5f94bd80fe3c" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_f61a56ed1169fe59fd019cf284e" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD CONSTRAINT "FK_9f5b32d06d63e60256bca71bb42" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD CONSTRAINT "FK_9c7a599292fa0a06669750e9425" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }
}
