import {
  DepositAppState,
  ProtocolRoles,
  ProposeMiddlewareContext,
  UninstallMiddlewareContext,
  JsonRpcProvider,
  InstallMiddlewareContext,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { validateDepositApp } from "./validation";

export const uninstallDepositMiddleware = async (
  context: UninstallMiddlewareContext,
  provider: JsonRpcProvider,
) => {
  const { role, appInstance, params } = context;

  if (!provider || !provider.getBalance) {
    throw new Error(
      `Uninstall deposit middleware needs access to a provider, got ${JSON.stringify(
        provider,
        null,
        2,
      )}`,
    );
  }

  const latestState = appInstance.latestState as DepositAppState;

  if (
    role === ProtocolRoles.initiator &&
    latestState.transfers[0].to !== getSignerAddressFromPublicIdentifier(params.initiatorIdentifier)
  ) {
    throw new Error(`Cannot uninstall deposit app without being the initiator`);
  }

  // TODO: withdrawal amount validation?
};

export const installDepositMiddleware = async (
  context: InstallMiddlewareContext,
  provider: JsonRpcProvider,
) => {
  const { appInstance, stateChannel } = context;
  const depositApp = stateChannel.appInstances.find(([id, app]) => {
    return (
      app.appDefinition === appInstance.appDefinition &&
      app.latestState["assetId"] === appInstance.latestState["assetId"]
    );
  });
  if (depositApp) {
    throw new Error(
      `Cannot install two deposit apps with the same asset id simultaneously. Existing app: ${depositApp[0]}`,
    );
  }
};

export const proposeDepositMiddleware = async (
  context: ProposeMiddlewareContext,
  provider: JsonRpcProvider,
) => {
  const { proposal, stateChannel, params } = context;
  const depositApp = stateChannel.appInstances.find(([id, app]) => {
    return (
      app.appDefinition === proposal.appDefinition &&
      app.latestState["assetId"] === proposal.latestState["assetId"]
    );
  });
  if (depositApp) {
    throw new Error(
      `Channel already has an installed deposit app with the same asset id. Existing app: ${depositApp[0]}`,
    );
  }
  await validateDepositApp(params, stateChannel, provider);
};
