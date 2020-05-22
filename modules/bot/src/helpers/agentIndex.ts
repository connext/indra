import axios, { AxiosResponse } from "axios";

const BOT_REGISTRY_URL = process.env.BOT_REGISTRY_URL;

export const addAgentAddressToIndex = async (signerAddress: string): Promise<void> => {
  return axios.post(`${BOT_REGISTRY_URL}/agent`, {
    signerAddress,
  });
};

const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * Math.floor(max));
};

export const getRandomAgentAddressFromIndex = async (): Promise<string> => {
  const { data: addresses }: AxiosResponse<string[]> = await axios.get(`${BOT_REGISTRY_URL}/agent`);
  const index = getRandomInt(addresses.length);
  return addresses[index];
};
