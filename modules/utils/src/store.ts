import { ChannelsMap } from "@connext/types";

export function safeJsonParse(value: any): any {
  try {
    // assert null --> undefined conversion
    return convertObjectValuesRecursive(JSON.parse(value), null, undefined);
  } catch {
    return value;
  }
}

function convertObjectValuesRecursive(obj: object, target: any, replacement: any): any {
  const ret = { ...obj };
  Object.keys(ret).forEach(key => {
    if (ret[key] === target) {
      ret[key] = replacement;
    } else if (typeof ret[key] === "object" && !Array.isArray(ret[key])) {
      ret[key] = convertObjectValuesRecursive(ret[key], target, replacement);
    }
  });
  return ret;
}

export function safeJsonStringify(value: any): string {
  // make sure undefined are converted to null
  return typeof value === "string"
    ? value
    : JSON.stringify(value, (key: string, value: any) =>
        typeof value === "undefined" ? null : value,
      );
}

export function reduceChannelsMap(entries: [string, any][]): ChannelsMap {
  return entries.reduce((channels, [path, value]) => {
    const _value = safeJsonParse(value);
    if (path.includes("channel")) {
      channels[_value.multisigAddress] = _value;
    }
    return channels;
  }, {});
}
