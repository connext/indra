import axios, { AxiosResponse } from "axios";

// Gets the chainId from the provider URL using a regular POST method
// This is done as a workaround to get the network information before
// creating the provider object:
// https://github.com/connext/indra/issues/1281
export const getChainId = async (ethProviderUrl: string) => {
  const chainIdResponse: AxiosResponse<number> = await axios.post(
    `${ethProviderUrl}`,
    {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
    },
    { headers: { "content-type": "application/json" } },
  );
  return chainIdResponse.data;
};
