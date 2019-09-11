import { Node } from "@counterfactual/types";
import { createHandyClient, IHandyRedis } from "handy-redis";
import nodeFetch from "node-fetch";

export class RedisLockService implements Node.ILockService {
  private client?: IHandyRedis;

  constructor(redisUrl: string) {
    this.client = createHandyClient({ url: redisUrl });
  }
  async get(path: string): Promise<Node.Lock> {
    const stringified = await this.client!.get(path);
    if (!stringified) {
      return {
        locked: false,
        operation: "",
      } as Node.Lock;
    }
    return JSON.parse(stringified);
  }

  async set(path: string, value: Node.Lock): Promise<void> {
    await this.client!.set(path, JSON.stringify(value));
  }
}

export class WebdisLockService implements Node.ILockService {
  private myFetch?: (url: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;

  constructor(private readonly webdisUrl: string) {
    // @ts-ignore
    this.myFetch = typeof fetch !== "function" ? nodeFetch : fetch;
  }

  private constructWebdisCommandUrl(command: string, args: string[]): string {
    return `${this.webdisUrl}/${command}/${args.join("/")}`;
  }

  private constructGetCommand(key: string): string {
    return this.constructWebdisCommandUrl("GET", [key]);
  }

  private constructSetCommand(key: string, value: string): string {
    return this.constructWebdisCommandUrl("SET", [key, value]);
  }

  async get(path: string): Promise<Node.Lock> {
    const response = await this.myFetch!(this.constructGetCommand(path));
    if (!response) {
      return {
        locked: false,
        operation: "",
      } as Node.Lock;
    }
    return response.json();
  }

  async set(path: string, value: Node.Lock): Promise<void> {
    await this.myFetch!(this.constructSetCommand(path, JSON.stringify(value)));
  }
}
