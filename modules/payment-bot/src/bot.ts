import { Node as NodeTypes, SolidityABIEncoderV2Type } from "@counterfactual/types";
import { utils } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import EventEmitter from "events";
import inquirer from "inquirer";

import { getConnextClient } from "./";

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

interface Transfers {
  to: string;
  amount: BigNumber;
}

type AppState = SolidityABIEncoderV2Type & {
  transfers: Transfers[];
  finalized: boolean;
};

export async function showMainPrompt(): Promise<any> {
  const client = getConnextClient();
  const appInstances = await client.getAppInstances();
  if (appInstances.length > 0) {
    showAppInstancesPrompt();
  } else {
    showDirectionPrompt();
  }
}

export async function showAppInstancesPrompt(): Promise<any> {
  const client = getConnextClient();
  const appInstances = await client.getAppInstances();

  if (appInstances.length === 0) {
    return;
  }

  inquirer
    .prompt({
      choices: appInstances.map((app: any): any => app.id),
      message: "Select a payment thread to view options",
      name: "viewApp",
      type: "list",
    })
    .then((answers: any): void => {
      const { viewApp } = answers as Record<string, string>;
      showAppOptions(viewApp);
    });
}

function logThreadBalances(balances: AppState): void {
  const senderBalance = balances.transfers[0].amount
    ? utils.formatEther(balances.transfers[0].amount)
    : utils.formatEther(balances.transfers[0][1]);

  const receiverBalance = balances.transfers[1].amount
    ? utils.formatEther(balances.transfers[1].amount)
    : utils.formatEther(balances.transfers[1][1]);
  console.log(`Balances: Sender - ${senderBalance}, Receiver - ${receiverBalance}`);
}

async function showAppOptions(appId: string): Promise<any> {
  const client = getConnextClient();
  const getAppInstancesResult = await client.getAppInstanceDetails(appId);
  console.log("getAppInstancesResult: ", getAppInstancesResult);
  const choices = ["balances", "uninstall"];
  if (
    // TODO
    ((getAppInstancesResult.appInstance as any).initialState as AppState).transfers[0].to ===
    fromExtendedKey(client.publicIdentifier).derivePath("0").address
  ) {
    choices.unshift("send");
  }

  const getStateResult = await client.getAppState(appId);

  inquirer
    .prompt({
      choices,
      message: "Select an action to take",
      name: "viewOptions",
      type: "list",
    })
    .then(
      async (answers: any): Promise<any> => {
        const { viewOptions } = answers as Record<string, string>;
        if (viewOptions === "balances") {
          logThreadBalances(getStateResult.state as AppState);
          showAppOptions(appId);
        } else if (viewOptions === "send") {
          logThreadBalances(getStateResult.state as AppState);
          showSendPrompt(appId);
        } else if (viewOptions === "uninstall") {
          await uninstallVirtualApp(appId);
        }
      },
    );
}

function showSendPrompt(appId: string): any {
  const client = getConnextClient();

  inquirer
    .prompt({
      message: "Amount to send",
      name: "sendInVirtualApp",
      type: "input",
    })
    .then(
      async (answers: any): Promise<any> => {
        const { sendInVirtualApp } = answers as Record<string, string>;
        await client.takeAction(appId, {
          finalize: false,
          transferAmount: utils.parseEther(sendInVirtualApp),
        });
      },
    );
}

export function showDirectionPrompt(): void {
  inquirer
    .prompt([
      {
        choices: ["receiving", "sending"],
        message: "Are you sending or receiving payments?",
        name: "direction",
        type: "list",
      },
    ])
    .then((answers: any): any => {
      if ((answers as Record<string, string>).direction === "sending") {
        showOpenVirtualChannelPrompt();
      } else {
        console.log("Waiting to receive virtual install request...");
      }
    });
}

export function showOpenVirtualChannelPrompt(): void {
  inquirer
    .prompt([
      {
        message: "Enter counterparty public identifier:",
        name: "counterpartyPublicId",
        type: "input",
      },
      {
        message: "Enter Party A deposit amount:",
        name: "depositPartyA",
        type: "input",
      },
    ])
    .then((answers: any): void => {
      const { counterpartyPublicId, depositPartyA } = answers as Record<string, string>;
      openVirtualChannel(depositPartyA, counterpartyPublicId);
    });
}

async function openVirtualChannel(
  depositPartyA: string,
  counterpartyPublicId: string,
): Promise<any> {
  const client = getConnextClient();
  const result = await client.installTransferApp(
    counterpartyPublicId,
    utils.parseEther(depositPartyA),
  );
  myEmitter.emit("proposeInstallVirtualApp", result);
}

async function uninstallVirtualApp(appInstanceId: string): Promise<any> {
  const client = getConnextClient();
  await client.takeAction(appInstanceId, {
    finalize: true,
    transferAmount: Zero,
  });
  await client.uninstallVirtualApp(appInstanceId);
  myEmitter.emit("uninstallVirtualApp");
}

myEmitter.on("uninstallVirtualApp", async () => {
  const client = getConnextClient();
  client.logEthFreeBalance(await client.getFreeBalance());
  showMainPrompt();
});

myEmitter.on("proposeInstallVirtualApp", async (result: NodeTypes.MethodResponse) => {
  console.log("Propose virtual app install\n", JSON.stringify(result, null, 2));
  await showAppInstancesPrompt();
});

myEmitter.on("installVirtualApp", async (result: NodeTypes.MethodResponse) => {
  console.info(`Installed virtual app: `, JSON.stringify(result, null, 2));
  await showAppInstancesPrompt();
});

myEmitter.on("updateState", async (result: NodeTypes.MethodResponse) => {
  logThreadBalances((result as any).data.newState);
  await showAppInstancesPrompt();
});
