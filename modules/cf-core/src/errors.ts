import { stringify } from "@connext/utils";
import { BigNumber } from "ethers";

export const NO_MULTISIG_IN_PARAMS = (params: any): string => {
  return `No multisig address provided in params: ${stringify(params)}`;
};

export const APP_ALREADY_UNINSTALLED = (appIdentityHash: string): string =>
  `Cannot uninstall app ${appIdentityHash}, it has already been uninstalled`;

export const CANNOT_DEPOSIT = "Cannot deposit while another deposit is occurring in the channel.";

export const COIN_BALANCE_NOT_PROPOSED = "No coin balance refund app proposed in channel.";

export const NOT_YOUR_BALANCE_REFUND_APP =
  "Cannot uninstall a balance refund app without being the recipient";

export const USE_RESCIND_DEPOSIT_RIGHTS =
  "Use `rescindDepositRights` to uninstall coin balance refund app.";

export const BALANCE_REFUND_APP_ALREADY_INSTALLED =
  "Balance refund app is installed, please uninstall first.";

export const BALANCE_REFUND_APP_NOT_INSTALLED = "Balance refund app is not installed.";

export const CANNOT_UNINSTALL_FREE_BALANCE = (multisigAddress: string): string =>
  `Cannot uninstall the FreeBalance of channel: ${multisigAddress}`;

export const CONTRACT_NOT_DEPLOYED = `contract not deployed`;

export const CALL_EXCEPTION = `CALL_EXCEPTION`;

export const CANNOT_WITHDRAW =
  "Cannot withdraw while another deposit / withdraw app is active in the channel.";

export const CHANNEL_CREATION_FAILED =
  "Failed to create channel. Multisignature wallet cannot be deployed properly";

export const DEPOSIT_FAILED = "Failed to send funds to the multisig contract";

export const ETH_BALANCE_REFUND_NOT_UNINSTALLED =
  "The ETH balance refund AppInstance is still installed when it's not supposed to be";

export const FAILED_TO_GET_ERC20_BALANCE = (tokenAddress: string, address: string): string =>
  `Failed to get the balance of address: ${address} for ERC20 token: ${tokenAddress}`;

export const IMPROPERLY_FORMATTED_STRUCT = "Improperly formatted ABIEncoderV2 struct";

export const INCORRECT_MULTISIG_ADDRESS = "Channel multisig address does not match expected";

export const INVALID_FACTORY_ADDRESS = (address: string): string =>
  `Channel factory address is invalid: ${address}`;

export const INVALID_MASTERCOPY_ADDRESS = (address: string): string =>
  `Multisig master address is invalid: ${address}`;

export const NO_NETWORK_PROVIDER_CREATE2 =
  "`getCreate2MultisigAddress` needs access to an eth provider within the network context";

export const INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT = (
  address: string,
  tokenAddress: string,
  amount: BigNumber,
  balance: BigNumber,
): string =>
  `Protocol engine's default signer ${address} has ${balance} and needs ${amount} of the specified ERC20 token ${tokenAddress} to deposit`;

export const INSUFFICIENT_FUNDS_TO_WITHDRAW = (
  address: string,
  amount: BigNumber,
  balance: BigNumber,
): string => {
  return `Protocol engine signer has ${balance} and needs ${amount} of token ${address} to withdraw`;
};

export const INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET = (
  publicIdentifier: string,
  multisigAddress: string,
  tokenAddress: string,
  balance: BigNumber,
  allocationAmount: BigNumber,
): string =>
  `Protocol engine with public identifier ${publicIdentifier} has insufficient funds in channel ${multisigAddress}
  for token ${tokenAddress} to allocate towards an AppInstance. Current free balance for token is ${balance},
  attempted allocation amount: ${allocationAmount} `;

export const INSUFFICIENT_FUNDS =
  "Protocol engine's default signer does not have enough funds for this action";

export const INVALID_ACTION = "Invalid action taken";

export const INVALID_NETWORK_NAME = "Invalid network name provided for initializing Node";

export const NO_ACTION_ENCODING_FOR_APP_INSTANCE =
  "The AppInstance does not have an Action encoding defined";

export const NO_APP_CONTRACT_ADDR = "The App Contract address is empty";

export const NO_APP_INSTANCE_FOR_GIVEN_HASH = (identityHash: string): string =>
  `No appInstance exists for identity hash ${identityHash}`;

export const NO_APP_INSTANCE_FOR_TAKE_ACTION = "No appIdentityHash specified to takeAction on";

export const NO_APP_IDENTITY_HASH_FOR_GET_STATE = "No appIdentityHash specified to get state for";

export const NO_APP_IDENTITY_HASH_TO_GET_DETAILS = "No appIdentityHash specified to get details";

export const NO_APP_IDENTITY_HASH_TO_INSTALL = "No appIdentityHash specified to install";

export const NO_APP_IDENTITY_HASH_TO_UNINSTALL = "No appIdentityHash specified to uninstall";

export const NO_MULTISIG_FOR_APP_IDENTITY_HASH =
  "No multisig address exists for the given appIdentityHash";

export const NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH = (id: string): string =>
  `No proposed AppInstance exists for the given appIdentityHash: ${id}`;

export const NO_STATE_CHANNEL_FOR_MULTISIG_ADDR = (multisigAddress: string): string =>
  `Call to getStateChannel failed when searching for multisig address: ${multisigAddress}. This probably means that the StateChannel does not exist yet.`;

export const NO_STATE_CHANNEL_FOR_APP_IDENTITY_HASH = (appIdentityHash: string): string =>
  `Call to getStateChannel failed when searching for app identity hash: ${appIdentityHash}.`;

export const NO_STATE_CHANNEL_FOR_OWNERS = (owners: string): string =>
  `Call to getStateChannel failed when searching by owners: ${owners}.`;

export const NO_TRANSACTION_HASH_FOR_MULTISIG_DEPLOYMENT =
  "The multisig deployment transaction does not have a hash";

export const NULL_INITIAL_STATE_FOR_PROPOSAL =
  "A proposed AppInstance cannot have an empty initial state";

export const STATE_OBJECT_NOT_ENCODABLE =
  "The state object is not encodable by the AppInstance's state encoding";

export const TWO_PARTY_OUTCOME_DIFFERENT_ASSETS = (assetA: string, assetB: string): string =>
  `For a TWO_PARTY_FIXED_OUTCOME there cannot be two kinds of tokens deposited: ${assetA} and ${assetB}`;

export const WITHDRAWAL_FAILED = "Failed to withdraw funds out of the multisig contract";

export const NO_MULTISIG_FOR_COUNTERPARTIES = (owners: string[]): string =>
  `Could not find multisig address between counterparties ${stringify(owners)}`;
