import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { isNullOrUndefined } from "util";
import { v4 as generateUUID } from "uuid";
import fetch from "node-fetch";
import {utils as ethers} from "ethers";

export const objMap = <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => R,
): { [key in keyof T]: R } => {
  const res: any = {}
  // TODO: fix hasOwnProperty ts err? (T can be any)
  // @ts-ignore
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = func(key as any, obj[key] as any)
  }}
  return res
}

export const objMapPromise = async <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => Promise<R>,
): Promise<{ [key in keyof T]: R }> => {
  const res: any = {}
  // TODO: fix?
  // @ts-ignore
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = await func(key as any, obj[key] as any)
  }}
  return res
}

export const insertDefault = (val: string, obj: any, keys: string[]): any => {
  const adjusted = {} as any
  keys.concat(Object.keys(obj)).map((k: any): any => {
    // check by index and undefined
    adjusted[k] = (isNullOrUndefined(obj[k]))
      ? val // not supplied set as default val
      : obj[k]
  })

  return adjusted
}

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

//TODO Temporary - this eventually should be exposed at the top level and retrieve from store
export async function getFreeBalance(
  node: Node,
  multisigAddress: string,
): Promise<NodeTypes.GetFreeBalanceStateResult> {
  const query = {
    params: { multisigAddress } as NodeTypes.GetFreeBalanceStateParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_FREE_BALANCE_STATE,
  };

  const { result } = await node.call(query.type, query);

  return result as NodeTypes.GetFreeBalanceStateResult;
}

//TODO Should we keep this? It's a nice helper to break out by key. Maybe generalize?
export function logEthFreeBalance(
  freeBalance: NodeTypes.GetFreeBalanceStateResult,
) {
  console.info(`Channel's free balance`);
  for (const key in freeBalance) {
    console.info(key, ethers.formatEther(freeBalance[key]));
  }
}

// TODO Temporary fn which gets multisig address via http.
// This should eventually be derived internally from user/node xpub.
export async function getMultisigAddress(
  baseURL: string,
  xpub: string,
): Promise<string> {
  const bot = await getUser(baseURL, xpub);
  console.log("bot: ", bot);
  const multisigAddress = bot.channels.length > 0? bot.channels[0].multisigAddress : undefined;
  if (!multisigAddress) {
    console.info(
      `The Bot doesn't have a channel with the Playground yet...Waiting for another [hardcoded] 2 seconds`,
    );
    // Convert to milliseconds
    await delay(2 * 1000).then(() => getMultisigAddress(baseURL, xpub));
  }
  return multisigAddress;
}

// TODO Temporary fn which gets user details via http.
export async function getUser(baseURL: string, xpub: string): Promise<any> {
  if (!xpub) {
      throw new Error("getUser(): xpub is required");
  }

  try {
      const userJson = await get(baseURL, `users/${xpub}`);

      return userJson;
  } catch (e) {
      return Promise.reject(e);
  }
}

//TODO Temporary fn which deploys multisig and returns address/hash
export async function createAccount(
  baseURL: string,
  user: { xpub: string },
): Promise<object> {
  try {
    const userRes = await post(baseURL, "users", user);

    const multisigRes = await post(baseURL, "channels", {
      counterpartyXpub: user.xpub,
    });

    console.log("multisigRes: ", multisigRes);

    return {
      ...userRes,
      transactionHash: (multisigRes as any).transactionHash,
    };
  } catch (e) {
    return Promise.reject(e);
  }
}

//TODO ???
function timeout(delay: number = 30000) {
  const handler = setTimeout(() => {
    throw new Error("Request timed out");
  }, delay);

  return {
    cancel() {
      clearTimeout(handler);
    },
  };
}

//TODO Temporary!!
async function get(baseURL: string, endpoint: string): Promise<object> {
  const requestTimeout = timeout();

  const httpResponse = await fetch(`${baseURL}/${endpoint}`, {
    method: "GET",
  });

  requestTimeout.cancel();

  let response;
  let retriesAvailable = 10;

  while (typeof response === "undefined") {
    try {
      response = await httpResponse.json();
    } catch (e) {
      retriesAvailable -= 1;
      if (e.type === "invalid-json" && retriesAvailable >= 0) {
        console.log(
          `Call to ${baseURL}/api/${endpoint} returned invalid JSON. Retrying (attempt #${10 -
            retriesAvailable}).`,
        );
        await delay(3000);
      } else throw e;
    }
  }

  if (response.errors) {
    const error = response.errors[0];
    throw error;
  }

  return response;
}

//TODO Temporary!!
async function post(baseURL: string, endpoint: string, data: any) {
  const body = JSON.stringify(data);
  const httpResponse = await fetch(`${baseURL}/${endpoint}`, {
    body,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    method: "POST",
  });

  const response = await httpResponse.json();

  if (response.errors) {
    const error = response.errors[0];
    throw error;
  }

  return response;
}