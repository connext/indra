import { Node, UninstallVirtualMessage } from "@counterfactual/node";
import {
  Address,
  AppInstanceID,
  Node as NodeTypes,
  OutcomeType,
  SolidityABIEncoderV2Type,
} from "@counterfactual/types";
import { utils } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import EventEmitter from "events";
import inquirer from "inquirer";
import { v4 as generateUUID } from "uuid";

import { config } from "./config";
import { getFreeBalance, logEthFreeBalance } from "./utils";

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

type AppAction = SolidityABIEncoderV2Type & {
  transferAmount: BigNumber;
  finalize: boolean;
};

interface RespondData {
  appInstanceId: AppInstanceID;
  newState: SolidityABIEncoderV2Type;
}

function respond(node: Node, nodeAddress: Address, data: RespondData): void {
  console.log("appInstanceId, newState: ", data.appInstanceId, data.newState);
}

export async function connectNode(
  node: Node,
  botPublicIdentifier: string,
  multisigAddress?: string,
): Promise<any> {
  node.on(
    NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
    async (data: any): Promise<any> => {
      const appInstanceId = data.data.appInstanceId;
      const intermediaries = data.data.params.intermediaries;
      const request = {
        params: {
          appInstanceId,
          intermediaries,
        },
        requestId: generateUUID(),
        type: NodeTypes.MethodName.INSTALL_VIRTUAL,
      };
      try {
        const result = await node.call(request.type, request);
        myEmitter.emit("installVirtualApp", node, result);
        node.on(
          NodeTypes.EventName.UPDATE_STATE,
          async (updateEventData: any): Promise<void> => {
            if (updateEventData.data.appInstanceId === appInstanceId) {
              respond(node, botPublicIdentifier, updateEventData);
            }
          },
        );
      } catch (e) {
        console.error("Node call to install virtual app failed.");
        console.error(request);
        console.error(e);
      }
    },
  );

  node.on(
    NodeTypes.EventName.INSTALL_VIRTUAL,
    async (installVirtualData: any): Promise<any> => {
      console.log("installVirtualData: ", installVirtualData);
      myEmitter.emit("installVirtualApp", node, installVirtualData);
    },
  );

  node.on(
    NodeTypes.EventName.UPDATE_STATE,
    async (updateStateData: any): Promise<any> => {
      myEmitter.emit("updateState", node, updateStateData);
    },
  );

  if (multisigAddress) {
    node.on(
      NodeTypes.EventName.UNINSTALL_VIRTUAL,
      async (uninstallMsg: UninstallVirtualMessage) => {
        console.info(`Uninstalled app`);
        console.info(uninstallMsg);
        myEmitter.emit("uninstallVirtualApp", node, multisigAddress);
      },
    );
  }

  console.info(`Bot is ready to serve`);
}

export async function showMainPrompt(node: Node): Promise<any> {
  const { result } = (await node.call(NodeTypes.MethodName.GET_APP_INSTANCES, {
    params: {} as NodeTypes.GetAppInstancesParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_APP_INSTANCES,
  })) as Record<string, NodeTypes.GetAppInstancesResult>;
  if (result.appInstances.length > 0) {
    showAppInstancesPrompt(node);
  } else {
    showDirectionPrompt(node);
  }
}

export async function showAppInstancesPrompt(node: Node): Promise<any> {
  const { result } = (await node.call(NodeTypes.MethodName.GET_APP_INSTANCES, {
    params: {} as NodeTypes.GetAppInstancesParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_APP_INSTANCES,
  })) as Record<string, NodeTypes.GetAppInstancesResult>;

  if (result.appInstances.length === 0) {
    return;
  }

  inquirer
    .prompt({
      choices: result.appInstances.map((app: any): any => app.id),
      message: "Select a payment thread to view options",
      name: "viewApp",
      type: "list",
    })
    .then(
      async (answers: any): Promise<any> => {
        const { viewApp } = answers as Record<string, string>;
        await showAppOptions(node, viewApp);
      },
    );
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

async function showAppOptions(node: Node, appId: string): Promise<any> {
  const { result: getAppInstancesResult } = (await node.call(
    NodeTypes.MethodName.GET_APP_INSTANCE_DETAILS,
    {
      params: {
        appInstanceId: appId,
      } as NodeTypes.GetAppInstanceDetailsParams,
      requestId: generateUUID(),
      type: NodeTypes.MethodName.GET_APP_INSTANCES,
    },
  )) as Record<string, NodeTypes.GetAppInstanceDetailsResult>;
  const choices = ["balances", "uninstall"];
  if (
    ((getAppInstancesResult.appInstance as any).initialState as AppState).transfers[0].to ===
    fromExtendedKey(node.publicIdentifier).derivePath("0").address
  ) {
    choices.unshift("send");
  }

  const { result: getStateResult } = (await node.call(NodeTypes.MethodName.GET_STATE, {
    params: {
      appInstanceId: appId,
    } as NodeTypes.GetStateParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_STATE,
  })) as Record<string, NodeTypes.GetStateResult>;

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
          showAppOptions(node, appId);
        } else if (viewOptions === "send") {
          logThreadBalances(getStateResult.state as AppState);
          showSendPrompt(node, appId);
        } else if (viewOptions === "uninstall") {
          await uninstallVirtualApp(node, appId);
        }
      },
    );
}

function showSendPrompt(node: Node, appId: string): any {
  inquirer
    .prompt({
      message: "Amount to send",
      name: "sendInVirtualApp",
      type: "input",
    })
    .then(
      async (answers: any): Promise<any> => {
        const { sendInVirtualApp } = answers as Record<string, string>;
        const request: NodeTypes.MethodRequest = {
          params: {
            action: {
              finalize: false,
              transferAmount: utils.parseEther(sendInVirtualApp),
            } as AppAction,
            appInstanceId: appId,
          } as NodeTypes.TakeActionParams,
          requestId: generateUUID(),
          type: NodeTypes.MethodName.TAKE_ACTION,
        };
        await node.call(request.type, request);
      },
    );
}

export function showDirectionPrompt(node: Node): void {
  inquirer
    .prompt([
      {
        choices: ["sending", "receiving"],
        message: "Are you sending or receiving payments?",
        name: "direction",
        type: "list",
      },
    ])
    .then((answers: any): any => {
      if ((answers as Record<string, string>).direction === "sending") {
        showOpenVirtualChannelPrompt(node);
      } else {
        console.log("Waiting to receive virtual install request...");
      }
    });
}

export function showOpenVirtualChannelPrompt(node: Node): void {
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
    .then(
      async (answers: any): Promise<any> => {
        const { counterpartyPublicId, depositPartyA } = answers as Record<string, string>;
        await openVirtualChannel(node, depositPartyA, counterpartyPublicId);
      },
    );
}

async function openVirtualChannel(
  node: Node,
  depositPartyA: string,
  counterpartyPublicId: string,
): Promise<any> {
  const request: NodeTypes.MethodRequest = {
    params: {
      abiEncodings: {
        actionEncoding: "tuple(uint256 transferAmount, bool finalize)",
        stateEncoding: "tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)",
      },
      appDefinition: "0xfDd8b7c07960214C025B74e28733D30cF67A652d", // TODO: contract address of app
      asset: { assetType: 0 },
      initialState: {
        finalized: false,
        transfers: [
          {
            amount: utils.parseEther(depositPartyA),
            to: fromExtendedKey(node.publicIdentifier).derivePath("0").address,
          },
          {
            amount: Zero,
            to: fromExtendedKey(counterpartyPublicId).derivePath("0").address,
          },
        ],
      } as AppState,
      intermediaries: [config.intermediaryIdentifier],
      myDeposit: utils.parseEther(depositPartyA),
      outcomeType: OutcomeType.TWO_PARTY_DYNAMIC_OUTCOME, // TODO: IS THIS RIGHT???
      peerDeposit: Zero,
      proposedToIdentifier: counterpartyPublicId,
      timeout: Zero,
    } as NodeTypes.ProposeInstallVirtualParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.PROPOSE_INSTALL_VIRTUAL,
  };
  const result = await node.call(request.type, request);
  myEmitter.emit("proposeInstallVirtualApp", node, result);
}

async function uninstallVirtualApp(node: Node, appInstanceId: string): Promise<any> {
  await node.call(NodeTypes.MethodName.TAKE_ACTION, {
    params: {
      action: {
        finalize: true,
        transferAmount: Zero,
      } as AppAction,
      appInstanceId,
    } as NodeTypes.TakeActionParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.TAKE_ACTION,
  });

  await node.call(NodeTypes.MethodName.UNINSTALL_VIRTUAL, {
    params: {
      appInstanceId,
      intermediaryIdentifier: config.intermediaryIdentifier,
    } as NodeTypes.UninstallVirtualParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.UNINSTALL_VIRTUAL,
  });
  myEmitter.emit("uninstallVirtualApp", node);
}

myEmitter.on("uninstallVirtualApp", async (node: Node, multisigAddress: string) => {
  logEthFreeBalance(await getFreeBalance(node, multisigAddress));
  showMainPrompt(node);
});

myEmitter.on("proposeInstallVirtualApp", async (node: Node, result: NodeTypes.MethodResponse) => {
  console.log("Propose virtual app install\n", JSON.stringify(result, null, 2));
  await showAppInstancesPrompt(node);
});

myEmitter.on("installVirtualApp", async (node: Node, result: NodeTypes.MethodResponse) => {
  console.info(`Installed virtual app: `, JSON.stringify(result, null, 2));
  await showAppInstancesPrompt(node);
});

myEmitter.on("updateState", async (node: Node, result: NodeTypes.MethodResponse) => {
  logThreadBalances((result as any).data.newState);
  await showAppInstancesPrompt(node);
});
