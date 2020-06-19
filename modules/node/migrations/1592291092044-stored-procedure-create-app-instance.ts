import { MigrationInterface, QueryRunner } from "typeorm";

export class storedProcedureCreateAppInstance1592291092044 implements MigrationInterface {
  name = "storedProcedureCreateAppInstance1592291092044";
  public async up(queryRunner: QueryRunner): Promise<any> {
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
    ) RETURNS BOOLEAN AS $$
    DECLARE
    BEGIN
      UPDATE "app_instance" SET 
        "type" = 'INSTANCE', 
        "latestState" = app_instance_json->'latestState',
        "stateTimeout" = app_instance_json->>'stateTimeout', 
        "latestVersionNumber" = (app_instance_json->>'latestVersionNumber')::INTEGER,
        "channelMultisigAddress" = app_instance_json->>'multisigAddress',
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_instance_json->>'identityHash';
      
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
    await queryRunner.query(`DROP FUNCTION create_app_instance(jsonb,jsonb,jsonb);`, undefined);
  }
}
