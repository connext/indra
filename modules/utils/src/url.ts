import { isNode } from "./env";

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
  // nats://daicard.io/api/messaging
  // nats://nats:4222
  // replace url protocol
  let url = replaceUrlProtocol(
    nodeUrl,
    isNode()
      ? "nats"
      : nodeUrl
          .split("://")
          .shift()
          .replace(/^http/, "ws"),
  );
  if (isNode()) {
    return url.includes("/api") ? url.split("/api")[0] + ":4222" : url.split(":8080")[0] + ":4222";
  }
  url = `${url}/messaging`;
  return url;
};
