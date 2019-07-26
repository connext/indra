import { MessagingConfig } from "@connext/messaging";
import { ContractAddresses, KnownNodeAppNames } from "@connext/types";
import chain3AddressBook from "@counterfactual/contracts/networks/3.json";
import chain4AddressBook from "@counterfactual/contracts/networks/4.json";
import chain42AddressBook from "@counterfactual/contracts/networks/42.json";
import { OutcomeType } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";
import { Network as EthNetwork } from "ethers/utils";
import * as fs from "fs";

import { Network } from "../constants";

type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

type DefaultApp = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  appDefinitionAddress: string;
  name: string;
  network: Network;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor() {
    this.envConfig = process.env;
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

  async getEthNetwork(): Promise<EthNetwork> {
    const ethNetwork = await this.getEthProvider().getNetwork();
    if (ethNetwork.name === "unknown" && ethNetwork.chainId === 4447) {
      ethNetwork.name = "ganache";
    }
    return ethNetwork;
  }

  async getContractAddresses(): Promise<ContractAddresses> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const processCfAddressBook = (addressBook: any): any => {
      const ethAddresses = {} as any;
      for (const contract of addressBook) {
        ethAddresses[contract.contractName] = contract.address.toLowerCase();
      }
      if (ethAddresses.Migrations) delete ethAddresses.Migrations;
      return ethAddresses;
    };
    let ethAddresses = {} as any;
    if (chainId === "3") ethAddresses = processCfAddressBook(chain3AddressBook);
    if (chainId === "4") ethAddresses = processCfAddressBook(chain4AddressBook);
    if (chainId === "42") ethAddresses = processCfAddressBook(chain42AddressBook);
    const ethAddressBook = JSON.parse(this.get("INDRA_ETH_CONTRACT_ADDRESSES"));
    Object.keys(ethAddressBook[chainId]).map((contract: string): void => {
      ethAddresses[contract] = ethAddressBook[chainId][contract].address.toLowerCase();
    });
    return ethAddresses as ContractAddresses;
  }

  async getTokenAddress(): Promise<string> {
    const chainId = (await this.getEthNetwork()).chainId.toString();
    const ethAddressBook = JSON.parse(this.get("INDRA_ETH_CONTRACT_ADDRESSES"));
    return ethAddressBook[chainId].Token.address.toLowerCase();
  }

  async getDefaultApps(): Promise<DefaultApp[]> {
    const ethNetwork = await this.getEthNetwork();
    const addressBook = await this.getContractAddresses();
    return [
      {
        actionEncoding: "tuple(uint256 transferAmount, bool finalize)",
        allowNodeInstall: false,
        appDefinitionAddress: addressBook[KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER],
        name: KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER,
        network: Network[ethNetwork.name.toUpperCase()],
        outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
        stateEncoding: "tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)",
      },
      {
        allowNodeInstall: true,
        appDefinitionAddress: addressBook[KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP],
        name: KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP,
        network: Network[ethNetwork.name.toUpperCase()],
        outcomeType: OutcomeType.COIN_TRANSFER_DO_NOT_USE,
        stateEncoding:
          "tuple(tuple(address to, address[] coinAddress, uint256[] balance)[] coinBalances)",
      },
    ];
  }

  getLogLevel(): number {
    return parseInt(this.get("INDRA_LOG_LEVEL"), 10);
  }

  getMnemonic(): string {
    return this.get("INDRA_ETH_MNEMONIC");
  }

  getMessagingConfig(): MessagingConfig {
    return {
      clusterId: this.get("INDRA_NATS_CLUSTER_ID"),
      logLevel: this.getLogLevel(), // <- this is very verbose just fyi
      messagingUrl: (this.get("INDRA_NATS_SERVERS") || "").split(","),
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
