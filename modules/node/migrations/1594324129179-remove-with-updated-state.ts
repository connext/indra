import { MigrationInterface, QueryRunner } from "typeorm";

export class removeWithUpdatedState1594324129179 implements MigrationInterface {
  name = "removeWithUpdatedState1594324129179";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "set_state_commitment" WHERE "appIdentityHash" IN (SELECT "identityHash" FROM "app_instance" WHERE "type" = 'REJECTED');`,
      undefined,
    );
    await queryRunner.query(`DELETE FROM "app_instance" WHERE "type" = 'REJECTED'`, undefined);
    await queryRunner.query(
      `ALTER TYPE "public"."app_instance_type_enum" RENAME TO "app_instance_type_enum_old"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "app_instance_type_enum" AS ENUM('PROPOSAL', 'INSTANCE', 'FREE_BALANCE', 'UNINSTALLED')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "type" TYPE "app_instance_type_enum" USING "type"::"text"::"app_instance_type_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "app_instance_type_enum_old"`, undefined);

    // Update remove app instance to set the latest state of the app
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS remove_app_instance(text,jsonb,jsonb);`,
      undefined,
    );

    await queryRunner.query(
      `
    CREATE OR REPLACE FUNCTION remove_app_instance(
      removed_app JSONB,
      free_balance_app_instance JSONB,
      signed_free_balance_update JSONB
    ) RETURNS TEXT AS $$
    DECLARE
      remove_app_result TEXT;
      update_free_balance_result TEXT;
      update_set_state_result TEXT;
    BEGIN
      UPDATE "app_instance" SET 
        "type" = 'UNINSTALLED',
        "channelMultisigAddress" = NULL, 
        "updatedAt" = CURRENT_TIMESTAMP,
        "latestState" = removed_app->'latestState',
        "stateTimeout" = removed_app->>'stateTimeout', 
        "latestVersionNumber" = (removed_app->>'latestVersionNumber')::INTEGER
      WHERE "identityHash" = removed_app->>'identityHash'
      RETURNING "identityHash" INTO remove_app_result;
    
      UPDATE "app_instance" SET 
        "latestState" = free_balance_app_instance->'latestState',
        "stateTimeout" = free_balance_app_instance->>'stateTimeout', 
        "latestVersionNumber" = (free_balance_app_instance->>'latestVersionNumber')::INTEGER,
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = free_balance_app_instance->>'identityHash'
      RETURNING "identityHash" INTO update_free_balance_result;
      
      UPDATE "set_state_commitment" SET 
        "appIdentity" = signed_free_balance_update->'appIdentity', 
        "appStateHash" = signed_free_balance_update->>'appStateHash', 
        "challengeRegistryAddress" = signed_free_balance_update->>'challengeRegistryAddress', 
        "signatures" = signed_free_balance_update->'signatures', 
        "stateTimeout" = signed_free_balance_update->>'stateTimeout', 
        "versionNumber" = (signed_free_balance_update->>'versionNumber')::INTEGER, 
        "transactionData" = signed_free_balance_update->>'transactionData',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "appIdentityHash" = free_balance_app_instance->>'identityHash'
      RETURNING "appIdentityHash" INTO update_set_state_result;

      IF remove_app_result IS NULL OR update_free_balance_result IS NULL OR update_set_state_result IS NULL
      THEN
        RAISE EXCEPTION 
        'Operation could not be completed: remove_app_result -> %, update_free_balance_result -> %, update_set_state_result -> %', 
        remove_app_result, 
        update_free_balance_result,
        update_set_state_result;
      END IF;
    
      RETURN remove_app_result;
    END;
    $$ LANGUAGE plpgsql;
          `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "app_instance_type_enum_old" AS ENUM('PROPOSAL', 'INSTANCE', 'FREE_BALANCE', 'REJECTED', 'UNINSTALLED')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "type" TYPE "app_instance_type_enum_old" USING "type"::"text"::"app_instance_type_enum_old"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "app_instance_type_enum"`, undefined);
    await queryRunner.query(
      `ALTER TYPE "app_instance_type_enum_old" RENAME TO  "app_instance_type_enum"`,
      undefined,
    );

    // Return procedure to previous migration (tx-data-stored-procedure)
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS remove_app_instance(text,jsonb,jsonb);`,
      undefined,
    );

    await queryRunner.query(
      `
    CREATE OR REPLACE FUNCTION remove_app_instance(
      app_identity_hash TEXT,
      free_balance_app_instance JSONB,
      signed_free_balance_update JSONB
    ) RETURNS TEXT AS $$
    DECLARE
      remove_app_result TEXT;
      update_free_balance_result TEXT;
      update_set_state_result TEXT;
    BEGIN
      UPDATE "app_instance" SET 
        "type" = 'UNINSTALLED',
        "channelMultisigAddress" = NULL, 
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_identity_hash
      RETURNING "identityHash" INTO remove_app_result;
    
      UPDATE "app_instance" SET 
        "latestState" = free_balance_app_instance->'latestState',
        "stateTimeout" = free_balance_app_instance->>'stateTimeout', 
        "latestVersionNumber" = (free_balance_app_instance->>'latestVersionNumber')::INTEGER,
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = free_balance_app_instance->>'identityHash'
      RETURNING "identityHash" INTO update_free_balance_result;
      
      UPDATE "set_state_commitment" SET 
        "appIdentity" = signed_free_balance_update->'appIdentity', 
        "appStateHash" = signed_free_balance_update->>'appStateHash', 
        "challengeRegistryAddress" = signed_free_balance_update->>'challengeRegistryAddress', 
        "signatures" = signed_free_balance_update->'signatures', 
        "stateTimeout" = signed_free_balance_update->>'stateTimeout', 
        "versionNumber" = (signed_free_balance_update->>'versionNumber')::INTEGER, 
        "transactionData" = signed_free_balance_update->>'transactionData',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "appIdentityHash" = free_balance_app_instance->>'identityHash'
      RETURNING "appIdentityHash" INTO update_set_state_result;

      IF remove_app_result IS NULL OR update_free_balance_result IS NULL OR update_set_state_result IS NULL
      THEN
        RAISE EXCEPTION 
        'Operation could not be completed: remove_app_result -> %, update_free_balance_result -> %, update_set_state_result -> %', 
        remove_app_result, 
        update_free_balance_result,
        update_set_state_result;
      END IF;
    
      RETURN remove_app_result;
    END;
    $$ LANGUAGE plpgsql;
          `,
      undefined,
    );
  }
}
