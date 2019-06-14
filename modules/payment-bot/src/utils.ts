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
    params: { multisigAddress } as NodeTypes.GetFreeBalanceStateParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_FREE_BALANCE_STATE,
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
  if (!(bot as any).multisigAddress) {
    console.info(
      `The Bot doesn't have a channel with the Playground yet...Waiting for another ${DELAY_SECONDS} seconds`,
    );
    // Convert to milliseconds
    await delay(DELAY_SECONDS * 1000).then(() =>
      fetchMultisig(baseURL, ethAddress),
    );
  }
  return ((await getUser(baseURL, ethAddress)) as any).multisigAddress;
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
      params: {
        amount: parseEther(amount),
        multisigAddress,
        notifyCounterparty: true,
      } as NodeTypes.DepositParams,
      requestId: generateUUID(),
      type: NodeTypes.MethodName.DEPOSIT,
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
): Promise<object> {
  try {
    const userRes = await post(baseURL, "users", user);

    const multisigRes = await post(baseURL, "channels", {
      xpub: user.xpub,
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

export async function getUser(baseURL: string, xpub: string): Promise<object> {
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
