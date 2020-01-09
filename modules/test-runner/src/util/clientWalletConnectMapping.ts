import WalletConnectBrowser from "@walletconnect/browser";
import { IConnextClient } from "@connext/types";

export let walletConnector: WalletConnectBrowser;

export const initWalletConnect = (uri: string, client: IConnextClient, chainId: number): void => {
  walletConnector = new WalletConnectBrowser({ uri });

  registerWalletConnectListeners(client, chainId);
};

export const registerWalletConnectListeners = async (client: IConnextClient, chainId: number): void => {
  walletConnector.on("session_request", (error: Error | null, payload: any) => {
    if (error) {
      throw error;
    }
    displaySessionApproval(payload.params[0], chainId);
  });

  // Subscribe to call requests
  walletConnector.on("call_request", async (error: Error | null, payload: any) => {
    if (error) {
      throw error;
    }

    if (payload.method.startsWith("chan_")) {
      await mapPayloadToClient(payload, client);
    } else {
      walletConnector.rejectRequest({ id: payload.id });
    }
  });

  walletConnector.on("disconnect", (error: Error | null, payload: any) => {
    if (error) {
      throw error;
    }

    // Delete walletConnector
    // cleanWalletConnect();
  });
};

// export const cleanWalletConnect = (): void  => {
//   // Delete walletConnector
//   walletConnector = null;
//   // delete url
//   localStorage.removeItem(`wcUri`);
// }

export const displaySessionApproval = (session: any, chainId: number): void => {
  //TODO: proc modal that approves the walletconnection from the wallet
  walletConnector.approveSession({ accounts: [], chainId });
};

const prettyPrint = (obj: any): string => {
  return JSON.stringify(obj, null, 2);
};

const verifyPayload = (payload: any): void => {
  const { params, id, method } = payload;

  if (!params || typeof params !== "object") {
    throw new Error(
      `WalletConnect Error - invalid payload params. Payload: ${prettyPrint(payload)}`,
    );
  }

  if (!id || typeof id !== "number") {
    throw new Error(`WalletConnect Error - invalid payload id. Payload: ${prettyPrint(payload)}`);
  }

  if (!method || typeof method !== "string") {
    throw new Error(
      `WalletConnect Error - invalid payload method. Payload: ${prettyPrint(payload)}`,
    );
  }

  return;
};

const mapPayloadToClient = async (payload: any, channel: any): Promise<void> => {
  try {
    verifyPayload(payload);

    const result = await channel.channelProvider.send(payload.method, payload.params);

    if (typeof result === "undefined") {
      const message = "WalletConnect Error - result is undefined";
      console.error(message);
      walletConnector.rejectRequest({ id: payload.id, error: { message } });
    } else {
      walletConnector.approveRequest({ id: payload.id, result });
    }
  } catch (e) {
    console.error(e.message);
    walletConnector.rejectRequest({ id: payload.id, error: { message: e.message } });
  }
};
