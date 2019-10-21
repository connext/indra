import WalletConnectBrowser from "@walletconnect/browser";
import { Node as NodeTypes } from "@counterfactual/types";

export let walletConnector = null;

export async function initWalletConnect(uri, client) {
  walletConnector = new WalletConnectBrowser({ uri });
  console.log("INITING");

  walletConnector.on("session_request", (error, payload) => {
    console.log("Received session request");
    if (error) {
      throw error;
    }
    displaySessionApproval(payload);

    // Handle Session Request

    /* payload:
        {
            id: 1,
            jsonrpc: '2.0'.
            method: 'session_request',
            params: [{
            peerId: '15d8b6a3-15bd-493e-9358-111e3a4e6ee4',
            peerMeta: {
                name: "WalletConnect Example",
                description: "Try out WalletConnect v1.0.0-beta",
                icons: ["https://example.walletconnect.org/favicon.ico"],
                url: "https://example.walletconnect.org",
                ssl: true
            }
            }]
        }
        */
  });

  // Subscribe to call requests
  walletConnector.on("call_request", async (error, payload) => {
    console.log("Received call request");
    if (error) {
      throw error;
    }

    if (payload.method.startsWith("chan_")) {
      await mapPayloadToClient(payload, client);
    } else {
      walletConnector.rejectRequest({ id: payload.id });
    }
    // Handle Call Request

    /* payload:
        {
            id: 1,
            jsonrpc: '2.0'.
            method: 'eth_sign',
            params: [
            "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
            "My email is john@doe.com - 1537836206101"
            ]
        }
        */
  });

  walletConnector.on("disconnect", (error, payload) => {
    if (error) {
      throw error;
    }

    // Delete walletConnector
  });
}

export function displaySessionApproval(payload) {
  console.log(`displaySessionApproval()`)
  walletConnector.approveSession({ accounts: [], chainId: 4447 });
  //TODO: proc modal that approves the walletconnection from the wallet
  console.log(`called walletConnector.approveSession()`)
}

async function mapPayloadToClient(payload, channel) {
  let result;
  try {
    switch (payload.method) {
      case "chan_config":
        result = await channel.channelProviderConfig(payload.params)
        break;
      case NodeTypes.RpcMethodName.DEPOSIT:
        result = await channel.providerDeposit(payload.params);
        break;
      case NodeTypes.RpcMethodName.GET_STATE:
        result = await channel.getState(payload.params);
        break;
      case NodeTypes.RpcMethodName.GET_APP_INSTANCES:
        result = await channel.getAppInstances(payload.params);
        break;
      case NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE:
        result = await channel.getFreeBalance(payload.params);
        break;
      case NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES:
        result = await channel.getProposedAppInstances(payload.params);
        break;
      case NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS:
        result = await channel.getAppInstanceDetails(payload.params);
        break;
      case NodeTypes.RpcMethodName.TAKE_ACTION:
        result = await channel.takeAction(payload.params);
        break;
      case NodeTypes.RpcMethodName.UPDATE_STATE:
        result = await channel.updateState(payload.params);
        break;
      case NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL:
        result = await channel.proposeInstallVirtualApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.PROPOSE_INSTALL:
        result = await channel.proposeInstallApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.INSTALL_VIRTUAL:
        result = await channel.installVirtualApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.INSTALL:
        result = await channel.installApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.UNINSTALL:
        result = await channel.uninstallApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL:
        result = await channel.uninstallVirtualApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.REJECT_INSTALL:
        result = await channel.rejectInstallApp(payload.params);
        break;
      case NodeTypes.RpcMethodName.WITHDRAW:
        result = await channel.providerWithdraw(payload.params);
        break;
      case NodeTypes.RpcMethodName.WITHDRAW_COMMITMENT:
        result = await channel.withdrawCommitment(payload.params);
        break;
      default:
        console.log(`WALLET CONNECT MAPPING ERROR: unknown method: ${payload.method}`);
        break;
    }
  } catch (e) {
    console.log("AHIOFEJOIFEJIOFEAJ: ", e);
  }
  walletConnector.approveRequest({ id: payload.id, result });
}
