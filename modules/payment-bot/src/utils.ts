import { Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { formatEther, parseEther } from "ethers/utils";
import fetch from "node-fetch";
import { v4 as generateUUID } from "uuid";

import { connectNode } from "./bot";

const API_TIMEOUT = 30000;
const DELAY_SECONDS = process.env.DELAY_SECONDS
  ? Number(process.env.DELAY_SECONDS)
  : 5;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function getFreeBalance(
  node: Node,
  multisigAddress: string,
): Promise<NodeTypes.GetFreeBalanceStateResult> {
  const query = {
    type: NodeTypes.MethodName.GET_FREE_BALANCE_STATE,
    requestId: generateUUID(),
    params: { multisigAddress } as NodeTypes.GetFreeBalanceStateParams,
  };

  const { result } = await node.call(query.type, query);

  return result as NodeTypes.GetFreeBalanceStateResult;
}

export function logEthFreeBalance(
  freeBalance: NodeTypes.GetFreeBalanceStateResult,
) {
  console.info(`Channel's free balance`);
  for (const key in freeBalance) {
    console.info(key, formatEther(freeBalance[key]));
  }
}

export async function fetchMultisig(baseURL: string, ethAddress: string) {
  const bot = await getUser(baseURL, ethAddress);
  if (!bot.multisigAddress) {
    console.info(
      `The Bot doesn't have a channel with the Playground yet...Waiting for another ${DELAY_SECONDS} seconds`,
    );
    // Convert to milliseconds
    await delay(DELAY_SECONDS * 1000).then(() =>
      fetchMultisig(baseURL, ethAddress),
    );
  }
  return (await getUser(baseURL, ethAddress)).multisigAddress;
}

/// Deposit and wait for counterparty deposit
export async function deposit(
  node: Node,
  amount: string,
  multisigAddress: string,
) {
  const myFreeBalanceAddress = node.ethFreeBalanceAddress;

  const preDepositBalances = await getFreeBalance(node, multisigAddress);

  if (Object.keys(preDepositBalances).length !== 2) {
    throw new Error("Unexpected number of entries");
  }

  if (!preDepositBalances[myFreeBalanceAddress]) {
    throw new Error("My address not found");
  }

  const [counterpartyFreeBalanceAddress] = Object.keys(
    preDepositBalances,
  ).filter(addr => addr !== myFreeBalanceAddress);

  console.log(`\nDepositing ${amount} ETH into ${multisigAddress}\n`);
  try {
    await node.call(NodeTypes.MethodName.DEPOSIT, {
      type: NodeTypes.MethodName.DEPOSIT,
      requestId: generateUUID(),
      params: {
        multisigAddress,
        amount: parseEther(amount),
        notifyCounterparty: true,
      } as NodeTypes.DepositParams,
    });

    const postDepositBalances = await getFreeBalance(node, multisigAddress);

    if (
      !postDepositBalances[myFreeBalanceAddress].gt(
        preDepositBalances[myFreeBalanceAddress],
      )
    ) {
      throw Error("My balance was not increased.");
    }

    console.info("Waiting for counter party to deposit same amount");

    const freeBalanceNotUpdated = async () => {
      return !(await getFreeBalance(node, multisigAddress))[
        counterpartyFreeBalanceAddress
      ].gt(preDepositBalances[counterpartyFreeBalanceAddress]);
    };

    while (await freeBalanceNotUpdated()) {
      console.info(
        `Waiting ${DELAY_SECONDS} more seconds for counter party deposit`,
      );
      await delay(DELAY_SECONDS * 1000);
    }

    logEthFreeBalance(await getFreeBalance(node, multisigAddress));
  } catch (e) {
    console.error(`Failed to deposit... ${e}`);
    throw e;
  }
}

function timeout(delay: number = API_TIMEOUT) {
  const handler = setTimeout(() => {
    throw new Error("Request timed out");
  }, delay);

  return {
    cancel() {
      clearTimeout(handler);
    },
  };
}

async function get(baseURL: string, endpoint: string): Promise<APIResponse> {
  const requestTimeout = timeout();

  const httpResponse = await fetch(`${baseURL}/${endpoint}`, {
    method: "GET",
  });

  requestTimeout.cancel();

  let response;
  let retriesAvailable = 10;

  while (typeof response === "undefined") {
    try {
      response = (await httpResponse.json()) as APIResponse;
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
    const error = response.errors[0] as APIError;
    throw error;
  }

  return response;
}

async function post(baseURL: string, endpoint, data) {
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

export async function afterUser(
  node: Node,
  botPublicIdentifer: string,
  multisigAddress: string,
) {
  console.log("Setting up bot's event handlers");

  await connectNode(node, botPublicIdentifer, multisigAddress);
}

// TODO: don't duplicate these from PG for consistency

export async function createAccount(
  baseURL: string,
  user: { xpub: string },
): Promise<UserSession> {
  try {
    const userRes = await post(baseURL, "users", user);

    const multisigRes = (await post(baseURL, "channels", {
      xpub: user.xpub,
    })) as APIResponse;

    console.log("multisigRes: ", multisigRes);

    return {
      ...userRes,
      transactionHash: (multisigRes as any).transactionHash,
    };
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function getUser(
  baseURL: string,
  xpub: string,
): Promise<UserSession> {
  if (!xpub) {
    throw new Error("getUser(): xpub is required");
  }

  try {
    const userJson = await get(baseURL, `users/${xpub}`);

    return userJson as any;
  } catch (e) {
    return Promise.reject(e);
  }
}

export type AppDefinition = {
  id: string;
  name: string;
  notifications?: number;
  slug: string;
  url: string;
  icon: string;
};

export interface UserChangeset {
  username: string;
  email: string;
  ethAddress: string;
  nodeAddress: string;
}

export type UserSession = {
  id: string;
  username: string;
  ethAddress: string;
  nodeAddress: string;
  email: string;
  multisigAddress: string;
  transactionHash: string;
  token?: string;
};

export type ComponentEventHandler = (event: CustomEvent<any>) => void;

export interface ErrorMessage {
  primary: string;
  secondary: string;
}

// TODO: Delete everything down below after JSONAPI-TS is implemented.

export type APIError = {
  status: HttpStatusCode;
  code: ErrorCode;
  title: string;
  detail: string;
};

export type APIResource<T = APIResourceAttributes> = {
  type: APIResourceType;
  id?: string;
  attributes: T;
  relationships?: APIResourceRelationships;
};

export type APIResourceAttributes = {
  [key: string]: string | number | boolean | undefined;
};

export type APIResourceType =
  | "user"
  | "matchmakingRequest"
  | "matchedUser"
  | "session"
  | "app";

export type APIResourceRelationships = {
  [key in APIResourceType]?: APIDataContainer
};

export type APIDataContainer<T = APIResourceAttributes> = {
  data: APIResource<T> | APIResourceCollection<T>;
};

export type APIResourceCollection<T = APIResourceAttributes> = APIResource<T>[];

export type APIResponse<T = APIResourceAttributes> = APIDataContainer<T> & {
  errors?: APIError[];
  meta?: APIMetadata;
  included?: APIResourceCollection;
};

export enum ErrorCode {
  SignatureRequired = "signature_required",
  InvalidSignature = "invalid_signature",
  AddressAlreadyRegistered = "address_already_registered",
  AppRegistryNotAvailable = "app_registry_not_available",
  UserAddressRequired = "user_address_required",
  NoUsersAvailable = "no_users_available",
  UnhandledError = "unhandled_error",
  UserNotFound = "user_not_found",
  TokenRequired = "token_required",
  InvalidToken = "invalid_token",
  UsernameAlreadyExists = "username_already_exists",
}

export enum HttpStatusCode {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  InternalServerError = 500,
}

export type APIMetadata = {
  [key: string]: string | number | boolean | APIMetadata;
};

export type APIRequest<T = APIResourceAttributes> = {
  data?: APIResource<T> | APIResourceCollection<T>;
  meta?: APIMetadata;
};

export type UserAttributes = {
  id: string;
  username: string;
  ethAddress: string;
  nodeAddress: string;
  email: string;
  multisigAddress: string;
  transactionHash: string;
  token?: string;
};

export type SessionAttributes = {
  ethAddress: string;
};

export type AppAttributes = {
  name: string;
  slug: string;
  icon: string;
  url: string;
};
