import { MessagingService } from "@connext/messaging";
import { MessagingConfig, VerifyNonceDtoType, ILoggerService } from "@connext/types";
import axios, { AxiosResponse } from "axios";
import { isNode } from "./lib";

export const replaceUrlProtocol = (url: string, protocol: string, delimiter: string = "://") => {
  let arr = url.split(delimiter);
  if (arr.length > 1) {
    arr.shift();
  }
  arr.unshift(protocol);
  return arr.join(delimiter);
};

export const replaceUrlPort = (url: string, port: number, delimiter: string = ":") => {
  const arr = url.split(delimiter);
  if (arr.length > 1) {
    arr.pop();
  }
  arr.push(`${port}`);
  return arr.join(delimiter);
};

export const formatMessagingUrl = (nodeUrl: string) => {
  // for backwards-compatiblity
  let url = nodeUrl.replace("/messaging", "");
  // replace url protocol
  url = replaceUrlProtocol(url, isNode() ? "nats" : "wss");
  // replace url port
  url = replaceUrlPort(url, 4222);
  return url;
};

export const getBearerToken = async (
  nodeUrl: string,
  xpub: string,
  getSignature: (nonce: string) => Promise<string>,
): Promise<string> => {
  const nonceRepsonse: AxiosResponse<string> = await axios.get(`${nodeUrl}/auth/${xpub}`);
  const nonce = nonceRepsonse.data;
  const sig = await getSignature(nonce);
  const verifyResponse: AxiosResponse<string> = await axios.post(`${nodeUrl}/auth`, {
    sig,
    userPublicIdentifier: xpub,
  } as VerifyNonceDtoType);
  return verifyResponse.data;
};

export const createMessagingService = async (
  logger: ILoggerService,
  nodeUrl: string,
  xpub: string,
  chainId: number,
  getSignature: (nonce: string) => Promise<string>,
): Promise<MessagingService> => {
  const messagingUrl = formatMessagingUrl(nodeUrl);
  logger.debug(`Creating messaging service client ${messagingUrl}`);
  const config: MessagingConfig = {
    messagingUrl,
    logger,
  };
  const key = `INDRA.${chainId}`;
  // create a messaging service client
  // do not specify a prefix so that clients can publish to node
  const messaging = new MessagingService(config, key, () =>
    getBearerToken(nodeUrl, xpub, getSignature),
  );
  await messaging.connect();
  return messaging;
};
