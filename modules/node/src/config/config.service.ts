import * as dotenv from "dotenv";
import * as fs from "fs";

import { NatsConfig } from "@connext/nats-messaging-client";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor(filePath?: string) {
    let fileConfig
    try {
      fileConfig = filePath ? dotenv.parse(fs.readFileSync(filePath)) : {}
    } catch (e) {
      console.error(`Error reading file: ${filePath}`)
      fileConfig = {}
    }
    this.envConfig = {
      ...fileConfig,
      ...process.env,
    }
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getNodeMnemonic(): string {
    return this.get("NODE_MNEMONIC");
  }

  getPostgresConfig(): PostgresConfig {
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
