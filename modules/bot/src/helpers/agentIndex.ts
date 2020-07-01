import axios, { AxiosResponse } from "axios";

const BOT_REGISTRY_URL = process.env.BOT_REGISTRY_URL;

export type BotRegistry = {
  add: (identifier: string) => Promise<void>;
  remove: (identifier: string) => Promise<void>;
  get: (index: number) => Promise<string>;
  getRandom: (exclude: string) => Promise<string>;
};

const registry: Set<string> = new Set();
export const internalBotRegistry: BotRegistry = {
  add: async (identifier: string): Promise<void> => {
    registry.add(identifier);
    return Promise.resolve();
  },
  remove: async (identifier: string): Promise<void> => {
    registry.delete(identifier);
    return Promise.resolve();
  },
  getRandom: async (exclude?: string): Promise<string> => {
    const regArray = Array.from(registry).filter(id => id !== exclude);
    const index = Math.floor(Math.random() * Math.floor(regArray.length));
    return regArray[index];
  },
  get: async (index: number): Promise<string> => {
    const regArray = Array.from(registry);
    return regArray[index];
  },
};

export const externalBotRegistry: BotRegistry = {
  add: async (identifier: string): Promise<void> => {
    return axios.post(`${BOT_REGISTRY_URL}/agent`, {
      identifier,
    });
  },

  remove: async (identifier: string): Promise<void> => {
    return axios.delete(`${BOT_REGISTRY_URL}/agent`, {
      data: { identifier },
    });
  },

  getRandom: async (exclude?: string): Promise<string> => {
    let { data: addresses }: AxiosResponse<string[]> = await axios.get(`${BOT_REGISTRY_URL}/agent`);
    addresses = addresses.filter((address) => address !== exclude);
    const index = Math.floor(Math.random() * Math.floor(addresses.length));
    return addresses[index];
  },

  get: async (index: number): Promise<string> => {
    const { data: addresses }: AxiosResponse<string[]> = await axios.get(`${BOT_REGISTRY_URL}/agent`);
    return addresses[index];
  },

};
