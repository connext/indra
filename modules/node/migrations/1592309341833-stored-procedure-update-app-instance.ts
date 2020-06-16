import { MigrationInterface, QueryRunner } from "typeorm";

export class storedProcedureUpdateAppInstance1592309341833 implements MigrationInterface {
  name = "storedProcedureUpdateAppInstance1592309341833";
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_app_instance(jsonb,jsonb);`, undefined);
    await queryRunner.query(
      `
    CREATE OR REPLACE FUNCTION update_app_instance(
        app_instance_json JSONB,
        signed_set_state_commitment JSONB
    ) RETURNS BOOLEAN AS $$
    DECLARE
    BEGIN
      UPDATE "app_instance" SET 
        "latestState" = app_instance_json->'latestState',
        "stateTimeout" = app_instance_json->>'stateTimeout', 
        "latestVersionNumber" = (app_instance_json->>'latestVersionNumber')::INTEGER,
        "updatedAt" = CURRENT_TIMESTAMP 
      WHERE "identityHash" = app_instance_json->>'identityHash';
      
      UPDATE "set_state_commitment" SET 
        "appIdentity" = signed_set_state_commitment->'appIdentity', 
        "appStateHash" = signed_set_state_commitment->>'appStateHash', 
        "challengeRegistryAddress" = signed_set_state_commitment->>'challengeRegistryAddress', 
        "signatures" = signed_set_state_commitment->'signatures', 
        "stateTimeout" = signed_set_state_commitment->>'stateTimeout', 
        "versionNumber" = (signed_set_state_commitment->>'versionNumber')::INTEGER, 
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "appIdentityHash" = app_instance_json->>'identityHash';
    
        RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql;
          `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`DROP FUNCTION update_app_instance(jsonb,jsonb);`, undefined);
  }
}
