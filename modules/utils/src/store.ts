import { ChannelsMap } from "@connext/types";

import { safeJsonParse } from "./json";

export function reduceChannelsMap(entries: [string, any][]): ChannelsMap {
  return entries.reduce((channels, [path, value]) => {
    const _value = safeJsonParse(value);
    if (path.includes("channel")) {
      channels[_value.multisigAddress] = _value;
    }
    return channels;
  }, {});
}
