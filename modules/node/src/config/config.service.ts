import { PostgresConnectionOptions } from "@counterfactual/postgresql-node-connector";
import * as dotenv from "dotenv";
import * as fs from "fs";

import { NatsConfig } from "../../../nats-messaging-client/src";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor(filePath: string) {
    this.envConfig = dotenv.parse(fs.readFileSync(filePath));
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getNodeMnemonic(): string {
    return this.get("NODE_MNEMONIC");
  }

  getPostgresConfig(): PostgresConnectionOptions {
    return {
      database: this.get("INDRA_PG_DATABASE"),
      host: this.get("INDRA_PG_HOST"),
      password: this.get("INDRA_PG_PASSWORD"),
      port: parseInt(this.get("INDRA_PG_PORT"), 10),
      username: this.get("INDRA_PG_USERNAME"),
    };
  }

  getNatsConfig(): NatsConfig {
    return {
      clusterId: this.get("INDRA_NATS_CLUSTER_ID"),
      servers: this.get("INDRA_NATS_SERVERS").split(","),
      token: this.get("INDRA_NATS_TOKEN"),
    };
  }
}
