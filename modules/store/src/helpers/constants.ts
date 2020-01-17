import { safeJsonStringify } from "./utils";

export const DEFAULT_ASYNC_STORAGE_KEY = "CONNEXT_STORE";
export const DEFAULT_STORE_PREFIX = "INDRA_CLIENT_CF_CORE";
export const DEFAULT_STORE_SEPARATOR = "/";
export const DEFAULT_FILE_STORAGE_EXT = ".json";
export const DEFAULT_FILE_STORAGE_DIR = "./connext-store";

export const PATH_CHANNEL = "channel";
export const PATH_PROPOSED_APP_INSTANCE_ID = "appInstanceIdToProposedAppInstance";

export const EMPTY_DATA = {};
export const EMPTY_STRINGIFIED_DATA = safeJsonStringify(EMPTY_DATA);
