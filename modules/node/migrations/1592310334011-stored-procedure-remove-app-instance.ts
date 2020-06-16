import { MigrationInterface, QueryRunner } from "typeorm";

export class storedProcedureRemoveAppInstance1592310334011 implements MigrationInterface {
  name = "storedProcedureRemoveAppInstance1592310334011";
  public async up(queryRunner: QueryRunner): Promise<any> {
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
    ) RETURNS BOOLEAN AS $$
    DECLARE
    BEGIN
      UPDATE "app_instance" SET 
        "type" = 'UNINSTALLED',
        "channelMultisigAddress" = NULL, 
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_identity_hash;
    
      UPDATE "app_instance" SET 
        "latestState" = free_balance_app_instance->'latestState',
        "stateTimeout" = free_balance_app_instance->>'stateTimeout', 
        "latestVersionNumber" = (free_balance_app_instance->>'latestVersionNumber')::INTEGER,
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = free_balance_app_instance->>'identityHash';
      
      UPDATE "set_state_commitment" SET 
        "appIdentity" = signed_free_balance_update->'appIdentity', 
        "appStateHash" = signed_free_balance_update->>'appStateHash', 
        "challengeRegistryAddress" = signed_free_balance_update->>'challengeRegistryAddress', 
        "signatures" = signed_free_balance_update->'signatures', 
        "stateTimeout" = signed_free_balance_update->>'stateTimeout', 
        "versionNumber" = (signed_free_balance_update->>'versionNumber')::INTEGER, 
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "appIdentityHash" = free_balance_app_instance->>'identityHash';
    
      RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql;
          `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS remove_app_instance(text,jsonb,jsonb);`,
      undefined,
    );
  }
}
