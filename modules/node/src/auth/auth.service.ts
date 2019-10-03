import { Inject, Injectable } from "@nestjs/common";
import { arrayify, HDNode, hexlify, randomBytes, verifyMessage } from "ethers/utils";

import { RedisProviderId } from "../constants";
import { CLogger, isValidHex, isXpub } from "../util";

const logger = new CLogger("AuthService");
const nonceLen = 16;
const nonceTTL = 2 * 60 * 60 * 1000;

const badToken = (warning: string): any => {
  logger.warn(warning);
  return { err: `Invalid token` } as any;
};

const badSubject = (warning: string): any => {
  logger.warn(warning);
  return { err: `Invalid subject` } as any;
};

@Injectable()
export class AuthService {
  private nonces: { [key: string]: { address: string; expiry: number } } = {};
  private signerCache: { [key: string]: string } = {};
  constructor() {}

  getNonce = async (address: string): Promise<string> => {
    if (!isValidHex(address, 20)) {
      return JSON.stringify({ err: "Invalid address" });
    }
    const nonce = hexlify(randomBytes(nonceLen));
    const expiry = Date.now() + nonceTTL;
    this.nonces[nonce] = { address, expiry };
    logger.debug(`getNonce: Gave address ${address} a nonce that expires at ${expiry}: ${nonce}`);
    return nonce;
  };

  useVerifiedPublicIdentifier = (callback: any): any => {
    return async (subject: string, data: { token: string }): Promise<string> => {
      // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      const xpubAddress = HDNode.fromExtendedKey(xpub).address;

      // Get & validate the nonce + signature from provided token
      if (!data.token || data.token.indexOf(":") === -1) {
        return badToken(`Missing or malformed token: ${data.token}`);
      }
      const token = data.token;
      const nonce = token.split(":")[0];
      const sig = token.split(":")[1];
      if (!isValidHex(nonce, nonceLen) || !isValidHex(sig, 65)) {
        return badToken(`Improperly formatted nonce or sig in token: ${token}`);
      }

      // Get & validate expected address/expiry from local nonce storage
      if (!this.nonces[nonce] || !this.nonces[nonce].address || !this.nonces[nonce].expiry) {
        return badToken(`Unknown nonce provided by ${xpubAddress}: ${nonce}`);
      }
      const { address, expiry } = this.nonces[nonce];
      if (xpubAddress !== address) {
        return badToken(`Given nonce is for address ${address} but xpub maps to ${xpubAddress}`);
      }
      if (Date.now() >= expiry) {
        delete this.nonces[nonce];
        return badToken(`Nonce for ${address} expired at ${expiry}`);
      }

      // Cache sig recovery calculation
      if (!this.signerCache[token]) {
        this.signerCache[token] = verifyMessage(arrayify(nonce), sig);
        logger.debug(`Recovered signer ${this.signerCache[token]} from token ${token}`);
      }
      const signer = this.signerCache[token];
      if (signer !== address) {
        return badToken(`Invalid sig for nonce ${nonce}: Got ${signer}, expected ${address}`);
      }

      return callback(xpub, data);
    };
  };
}
