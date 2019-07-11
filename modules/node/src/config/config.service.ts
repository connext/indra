import { MessagingConfig } from "@connext/messaging";
import chain3AddressBook from "@counterfactual/contracts/networks/3.json";
import chain4AddressBook from "@counterfactual/contracts/networks/4.json";
import chain42AddressBook from "@counterfactual/contracts/networks/42.json";
import { NetworkContext } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import * as dotenv from "dotenv";
import { JsonRpcProvider } from "ethers/providers";
import { Network } from "ethers/utils";
import * as fs from "fs";
import { Payload } from "ts-nats";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor(filePath?: string) {
    let fileConfig;
    try {
      fileConfig = filePath ? dotenv.parse(fs.readFileSync(filePath)) : {};
    } catch (e) {
      console.error(`Error reading dotenv file: ${filePath}`);
      fileConfig = {};
    }
    this.envConfig = {
      ...fileConfig,
      ...process.env,
    };
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getEthRpcUrl(): string {
    return this.get("INDRA_ETH_RPC_URL");
  }

  getEthProvider(): JsonRpcProvider {
    return new JsonRpcProvider(this.getEthRpcUrl());
  }

  async getEthNetwork(): Promise<Network> {
    const ethNetwork = await this.getEthProvider().getNetwork();
    if (ethNetwork.name === "unknown" && ethNetwork.chainId === 4447) {
      ethNetwork.name = "ganache";
    }
    return ethNetwork;
  }

  async getContractAddresses(): Promise<NetworkContext> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const processCfAddressBook = (addressBook: any): any => {
      const ethAddresses = {} as any;
      for (const contract of addressBook) {
        ethAddresses[contract.contractName] = contract.address;
      }
      if (ethAddresses.Migrations) delete ethAddresses.Migrations;
      return ethAddresses;
    };
    if (chainId === "3") return processCfAddressBook(chain3AddressBook);
    if (chainId === "4") return processCfAddressBook(chain4AddressBook);
    if (chainId === "42") return processCfAddressBook(chain42AddressBook);
    const ethAddresses = {} as any;
    const ethAddressBook = JSON.parse(this.get("INDRA_ETH_CONTRACT_ADDRESSES"));
    Object.keys(ethAddressBook[chainId]).map((contract: string): void => {
      ethAddresses[contract] = ethAddressBook[chainId][contract].address;
    });
    return ethAddresses as NetworkContext;
  }

  getMnemonic(): string {
    return this.get("INDRA_ETH_MNEMONIC");
  }

  getMessagingConfig(): MessagingConfig {
    return {
      clusterId: this.get("INDRA_NATS_CLUSTER_ID"),
      messagingUrl: (this.get("INDRA_NATS_SERVERS") || "").split(","),
      payload: Payload.JSON,
      token: this.get("INDRA_NATS_TOKEN"),
    };
  }

  getPort(): number {
    return parseInt(this.get("INDRA_PORT"), 10);
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
}
