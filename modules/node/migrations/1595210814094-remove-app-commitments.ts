import { MigrationInterface, QueryRunner } from "typeorm";

export class removeAppCommitments1595210814094 implements MigrationInterface {
  name = "removeAppCommitments1595210814094";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update remove app instance to set the latest state of the app
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS remove_app_instance(jsonb,jsonb,jsonb);`,
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
      remove_set_state_result TEXT;
      remove_conditional_result TEXT;
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

      DELETE FROM "set_state_commitment"
      WHERE "appIdentityHash" = removed_app->>'identityHash';

      DELETE FROM "conditional_transaction_commitment"
      WHERE "appIdentityHash" = removed_app->>'identityHash';
    
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
    // Return procedure to previous migration (remove-with-updated-state)
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS remove_app_instance(jsonb,jsonb,jsonb);`,
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
}
