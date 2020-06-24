import { MigrationInterface, QueryRunner } from "typeorm";

export class storedProcedureCreateAppProposal1592290983473 implements MigrationInterface {
  name = "storedProcedureCreateAppProposal1592290983473";
  public async up(queryRunner: QueryRunner): Promise<any> {
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
          ) RETURNS BOOLEAN AS $$
          DECLARE
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
              ) ON CONFLICT ("identityHash") DO NOTHING;
              
              UPDATE "channel" 
              SET 
                  "monotonicNumProposedApps" = num_proposed_apps, 
                  "updatedAt" = CURRENT_TIMESTAMP 
              WHERE "multisigAddress" = app_proposal->>'multisigAddress';
              
              INSERT INTO "set_state_commitment"(
                  "appIdentityHash", 
                  "appIdentity", 
                  "appStateHash", 
                  "challengeRegistryAddress", 
                  "signatures", 
                  "stateTimeout", 
                  "versionNumber", 
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
                  "signatures"
              ) VALUES (
                  signed_conditional_tx_commitment->>'appIdentityHash',
                  signed_conditional_tx_commitment->>'freeBalanceAppIdentityHash',
                  signed_conditional_tx_commitment->>'interpreterAddr',
                  signed_conditional_tx_commitment->>'interpreterParams',
                  signed_conditional_tx_commitment->>'multisigAddress',
                  ARRAY(SELECT jsonb_array_elements_text(signed_conditional_tx_commitment->'multisigOwners')),
                  ARRAY(SELECT jsonb_array_elements_text(signed_conditional_tx_commitment->'signatures'))
              ) ON CONFLICT ("appIdentityHash") DO NOTHING;
              
              RETURN TRUE;
          END;
          $$ LANGUAGE plpgsql;
          `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `DROP FUNCTION create_app_proposal(jsonb,integer,jsonb,jsonb);`,
      undefined,
    );
  }
}
