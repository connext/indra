import { MigrationInterface, QueryRunner } from "typeorm";

export class txDataStoredProcedures1594196572552 implements MigrationInterface {
  name = "txDataStoredProcedures1594196572552";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS create_app_proposal(jsonb,integer,jsonb,jsonb);`,
      undefined,
    );
    await queryRunner.query(
      `
      CREATE OR REPLACE FUNCTION create_app_proposal(
          app_proposal JSONB, 
          num_proposed_apps INTEGER, 
          signed_set_state_commitment JSONB, 
          signed_conditional_tx_commitment JSONB
      ) RETURNS TEXT AS $$
      DECLARE
          create_app_result TEXT;
          increment_num_proposed_apps_result TEXT;
      BEGIN
          INSERT INTO "app_instance"(
              "identityHash", 
              "type", 
              "appDefinition", 
              "stateEncoding", 
              "actionEncoding", 
              "appSeqNo", 
              "latestState", 
              "latestVersionNumber", 
              "initiatorDeposit", 
              "initiatorDepositAssetId", 
              "outcomeType", 
              "initiatorIdentifier", 
              "responderIdentifier", 
              "responderDeposit", 
              "responderDepositAssetId", 
              "defaultTimeout", 
              "stateTimeout", 
              "meta", 
              "latestAction", 
              "outcomeInterpreterParameters", 
              "channelMultisigAddress",
              "createdAt", 
              "updatedAt"
          ) VALUES (
              app_proposal->>'identityHash',
              'PROPOSAL',
              app_proposal->>'appDefinition',
              app_proposal#>>'{abiEncodings,stateEncoding}',
              app_proposal#>>'{abiEncodings,actionEncoding}',
              (app_proposal->>'appSeqNo')::INTEGER,
              app_proposal->'latestState',
              (app_proposal->>'latestVersionNumber')::INTEGER,
              app_proposal->>'initiatorDeposit',
              app_proposal->>'initiatorDepositAssetId', 
              (app_proposal->>'outcomeType')::app_instance_outcometype_enum, 
              app_proposal->>'initiatorIdentifier', 
              app_proposal->>'responderIdentifier', 
              app_proposal->>'responderDeposit', 
              app_proposal->>'responderDepositAssetId', 
              app_proposal->>'defaultTimeout', 
              app_proposal->>'stateTimeout', 
              app_proposal->'meta', 
              app_proposal->'latestAction', 
              app_proposal->'outcomeInterpreterParameters', 
              app_proposal->>'multisigAddress',
              DEFAULT, 
              DEFAULT
          ) ON CONFLICT ("identityHash") DO NOTHING
          RETURNING "identityHash" INTO create_app_result;
          
          UPDATE "channel" 
          SET 
              "monotonicNumProposedApps" = num_proposed_apps, 
              "updatedAt" = CURRENT_TIMESTAMP 
          WHERE "multisigAddress" = app_proposal->>'multisigAddress'
          RETURNING "multisigAddress" INTO increment_num_proposed_apps_result;

          IF increment_num_proposed_apps_result IS NULL
          THEN
              RAISE EXCEPTION 
              'Operation could not be completed: increment_num_proposed_apps_result -> %', 
              increment_num_proposed_apps_result;
          END IF;
          
          INSERT INTO "set_state_commitment"(
              "appIdentityHash", 
              "appIdentity", 
              "appStateHash", 
              "challengeRegistryAddress", 
              "signatures", 
              "stateTimeout", 
              "versionNumber", 
              "transactionData",
              "createdAt", 
              "updatedAt"
          ) VALUES (
              signed_set_state_commitment->>'appIdentityHash',
              signed_set_state_commitment->'appIdentity',
              signed_set_state_commitment->>'appStateHash',
              signed_set_state_commitment->>'challengeRegistryAddress',
              signed_set_state_commitment->'signatures',
              signed_set_state_commitment->>'stateTimeout',
              (signed_set_state_commitment->>'versionNumber')::INTEGER,
              signed_set_state_commitment->>'transactionData',
              DEFAULT, 
              DEFAULT
          ) ON CONFLICT ("appIdentityHash") DO NOTHING;
          
          INSERT INTO "conditional_transaction_commitment"(
              "appIdentityHash", 
              "freeBalanceAppIdentityHash", 
              "interpreterAddr", 
              "interpreterParams", 
              "multisigAddress", 
              "multisigOwners", 
              "transactionData",
              "signatures"
          ) VALUES (
              signed_conditional_tx_commitment->>'appIdentityHash',
              signed_conditional_tx_commitment->>'freeBalanceAppIdentityHash',
              signed_conditional_tx_commitment->>'interpreterAddr',
              signed_conditional_tx_commitment->>'interpreterParams',
              signed_conditional_tx_commitment->>'multisigAddress',
              ARRAY(SELECT jsonb_array_elements_text(signed_conditional_tx_commitment->'multisigOwners')),
              signed_conditional_tx_commitment->>'transactionData',
              ARRAY(SELECT jsonb_array_elements_text(signed_conditional_tx_commitment->'signatures'))
          ) ON CONFLICT ("appIdentityHash") DO NOTHING;
          
          RETURN create_app_result;
      END;
      $$ LANGUAGE plpgsql;
      `,
      undefined,
    );

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS create_app_instance(jsonb,jsonb,jsonb);`,
      undefined,
    );
    await queryRunner.query(
      `
    CREATE OR REPLACE FUNCTION create_app_instance(
        app_instance_json JSONB, 
        free_balance_app_instance JSONB, 
        signed_free_balance_update JSONB
    ) RETURNS TEXT AS $$
    DECLARE
      update_app_result TEXT;
      update_free_balance_result TEXT;
      update_set_state_result TEXT;
    BEGIN
        INSERT INTO "app_instance"(
          "identityHash", 
          "type", 
          "appDefinition", 
          "stateEncoding", 
          "actionEncoding", 
          "appSeqNo", 
          "latestState", 
          "latestVersionNumber", 
          "initiatorDeposit", 
          "initiatorDepositAssetId", 
          "outcomeType", 
          "initiatorIdentifier", 
          "responderIdentifier", 
          "responderDeposit", 
          "responderDepositAssetId", 
          "defaultTimeout", 
          "stateTimeout", 
          "meta", 
          "latestAction", 
          "outcomeInterpreterParameters", 
          "channelMultisigAddress",
          "createdAt", 
          "updatedAt"
      ) VALUES (
          app_instance_json->>'identityHash',
          'PROPOSAL',
          app_instance_json->>'appDefinition',
          app_instance_json#>>'{abiEncodings,stateEncoding}',
          app_instance_json#>>'{abiEncodings,actionEncoding}',
          (app_instance_json->>'appSeqNo')::INTEGER,
          app_instance_json->'latestState',
          (app_instance_json->>'latestVersionNumber')::INTEGER,
          app_instance_json->>'initiatorDeposit',
          app_instance_json->>'initiatorDepositAssetId', 
          (app_instance_json->>'outcomeType')::app_instance_outcometype_enum, 
          app_instance_json->>'initiatorIdentifier', 
          app_instance_json->>'responderIdentifier', 
          app_instance_json->>'responderDeposit', 
          app_instance_json->>'responderDepositAssetId', 
          app_instance_json->>'defaultTimeout', 
          app_instance_json->>'stateTimeout', 
          app_instance_json->'meta', 
          app_instance_json->'latestAction', 
          app_instance_json->'outcomeInterpreterParameters', 
          app_instance_json->>'multisigAddress',
          DEFAULT, 
          DEFAULT
      ) ON CONFLICT ("identityHash") DO NOTHING;
      UPDATE "app_instance" SET 
        "type" = 'INSTANCE', 
        "latestState" = app_instance_json->'latestState',
        "stateTimeout" = app_instance_json->>'stateTimeout', 
        "latestVersionNumber" = (app_instance_json->>'latestVersionNumber')::INTEGER,
        "channelMultisigAddress" = app_instance_json->>'multisigAddress',
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_instance_json->>'identityHash'
      RETURNING "identityHash" INTO update_app_result;
      
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

      IF update_app_result IS NULL OR update_free_balance_result IS NULL OR update_set_state_result IS NULL
      THEN
          RAISE EXCEPTION 
          'Operation could not be completed: update_app_result -> %, update_free_balance_result -> %, update_set_state_result -> %', 
          update_app_result, 
          update_free_balance_result, 
          update_set_state_result;
      END IF;
    
      RETURN update_app_result;
    END;
    $$ LANGUAGE plpgsql;
        `,
      undefined,
    );

    await queryRunner.query(`DROP FUNCTION IF EXISTS update_app_instance(jsonb,jsonb);`, undefined);
    await queryRunner.query(
      `
    CREATE OR REPLACE FUNCTION update_app_instance(
        app_instance_json JSONB,
        signed_set_state_commitment JSONB
    ) RETURNS TEXT AS $$
    DECLARE
      update_app_result TEXT;
      update_set_state_result TEXT;
    BEGIN
      UPDATE "app_instance" SET 
        "latestState" = app_instance_json->'latestState',
        "stateTimeout" = app_instance_json->>'stateTimeout', 
        "latestVersionNumber" = (app_instance_json->>'latestVersionNumber')::INTEGER,
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_instance_json->>'identityHash'
      RETURNING "identityHash" INTO update_app_result;
      
      UPDATE "set_state_commitment" SET 
        "appIdentity" = signed_set_state_commitment->'appIdentity', 
        "appStateHash" = signed_set_state_commitment->>'appStateHash', 
        "challengeRegistryAddress" = signed_set_state_commitment->>'challengeRegistryAddress', 
        "signatures" = signed_set_state_commitment->'signatures', 
        "stateTimeout" = signed_set_state_commitment->>'stateTimeout', 
        "versionNumber" = (signed_set_state_commitment->>'versionNumber')::INTEGER, 
        "transactionData" = signed_set_state_commitment->>'transactionData',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "appIdentityHash" = app_instance_json->>'identityHash'
      RETURNING "appIdentityHash" INTO update_set_state_result;

      IF update_app_result IS NULL OR update_set_state_result IS NULL
      THEN
          RAISE EXCEPTION 
          'Operation could not be completed: update_app_result -> %, update_set_state_result -> %', 
          update_app_result, 
          update_set_state_result;
      END IF;

      RETURN update_app_result;
    END;
    $$ LANGUAGE plpgsql;
          `,
      undefined,
    );

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

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
