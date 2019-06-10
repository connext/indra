import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";

export interface NatsConfig {
  servers: string[];
  token: string;
  clusterId: string;
}

export const NATS_CONFIGURATION_ENV = {
  servers: "NATS_SERVERS",
  token: "NATS_TOKEN",
  clusterId: "NATS_CLUSTER_ID"
};

export interface INatsMessaging extends Node.IMessagingService {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export class NatsServiceFactory {
  // TODO fix any

  constructor(private readonly connectionConfig: NatsConfig) {}

  connect() {
    throw Error("Connect service using NatsMessagingService.connect()");
  }

  createMessagingService(messagingServiceKey: string): INatsMessaging {
    return new NatsMessagingService(this.connectionConfig, messagingServiceKey);
  }
}

class NatsMessagingService implements INatsMessaging {
  private connection: nats.Client | undefined;

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string
  ) {}

  async connect() {
    this.connection = await nats.connect(this.configuration);
  }

  async send(to: string, msg: Node.NodeMessage) {
    if (!this.connection) {
      console.error(
        "Cannot register a connection with an uninitialized nats server"
      );
      return;
    }

    this.connection.publish(
      `${this.messagingServiceKey}.${to}.${msg.from}`,
      JSON.stringify(msg)
    );
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void) {
    if (!this.connection) {
      console.error(
        "Cannot register a connection with an uninitialized nats server"
      );
      return;
    }

    this.connection.subscribe(
      `${this.messagingServiceKey}.${address}.>`,
      (err, msg) => {
        if (err) {
          console.error(
            "Encountered an error while handling message callback",
            err
          );
        } else {
          callback(JSON.parse(msg.data) as Node.NodeMessage);
        }
      }
    );
  }

  async disconnect() {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }

    this.connection.close();
  }
}

export function confirmNatsConfigurationEnvVars() {
  if (
    !process.env.NATS_SERVERS ||
    !process.env.NATS_TOKEN ||
    !process.env.NATS_CLUSTER_ID
  ) {
    throw Error(
      "Nats server name(s), token and cluster ID must be set via env vars"
    );
  }
}
