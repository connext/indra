import {
  bigNumberify,
  recoverAddress,
  arrayify,
  hexlify,
  randomBytes,
  SigningKey,
  joinSignature,
  BigNumber,
} from "ethers/utils";

export const stringify = (obj: any, space: number = 0): string =>
  JSON.stringify(obj, replaceBN, space);

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? bigNumberify(value).toString() : value;

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export const bigNumberifyObj = (obj: any): any => {
  const res = {};
  Object.entries(obj).forEach(([key, value]: any): any => {
    if (value["_hex"]) {
      res[key] = bigNumberify(value as any);
      return;
    }
    res[key] = value;
    return;
  });
  return res;
};

export function createRandomBytesHexString(length: number) {
  return hexlify(randomBytes(length));
}

export function createRandomAddress() {
  return createRandomBytesHexString(20);
}

export function createRandom32ByteHexString() {
  return createRandomBytesHexString(32);
}

export async function recoverAddressWithEthers(digest: string, sig: string) {
  return recoverAddress(arrayify(digest), sig);
}

export async function signDigestWithEthers(privateKey: string, digest: string) {
  const signingKey = new SigningKey(privateKey);
  return joinSignature(signingKey.signDigest(arrayify(digest)));
}

export async function sortSignaturesBySignerAddress(
  digest: string,
  signatures: string[],
  recoverAddressFn: any = recoverAddressWithEthers,
): Promise<string[]> {
  return (
    await Promise.all(
      signatures.slice().map(async sig => ({ sig, addr: await recoverAddressFn(digest, sig) })),
    )
  )
    .sort((A, B) => {
      return new BigNumber(A.addr).lt(B.addr) ? -1 : 1;
    })
    .map(x => x.sig);
}
