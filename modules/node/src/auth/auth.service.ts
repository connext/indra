import { Injectable } from "@nestjs/common";
import { arrayify, hexlify, randomBytes, verifyMessage, isHexString } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerService } from "../logger/logger.service";
import { isValidHex, isXpub, isEthAddress } from "../util";

const nonceLen = 16;
const nonceTTL = 2 * 60 * 60 * 1000;

export function getAuthAddressFromXpub(xpub: string): string {
  return fromExtendedKey(xpub).derivePath("0").address;
}

@Injectable()
export class AuthService {
  private nonces: { [key: string]: { address: string; expiry: number } } = {};
  private signerCache: { [key: string]: string } = {};
  constructor(
    private readonly channelRepo: ChannelRepository,
    private readonly log: LoggerService,
  ) {
    this.log.setContext("AuthService");
  }

  badToken(warning: string): any {
    this.log.warn(warning);
    return { err: `Invalid token` } as any;
  }

  badSubject(warning: string): any {
    this.log.warn(warning);
    return { err: `Invalid subject` } as any;
  }

  async getNonce(address: string): Promise<string> {
    if (!isEthAddress(address)) {
      return JSON.stringify({ err: `Invalid address: ${address}` });
    }
    const nonce = hexlify(randomBytes(nonceLen));
    const expiry = Date.now() + nonceTTL;
    this.nonces[nonce] = { address, expiry };
    this.log.debug(
      `getNonce: Gave address ${address} a nonce that expires at ${expiry}: ${nonce}`,
    );
    return nonce;
  }

  useVerifiedMultisig(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const multisig = subject.split(".").pop(); // last item of subject is lock name
      if (!isEthAddress(multisig)) {
        const authRes = this.badSubject(
          `Subject's last item isn't a valid eth address: ${subject}`,
        );
        if (authRes) {
          this.log.error(
            `Auth failed (${authRes.err}) but we're just gonna ignore that for now..`,
          );
          return callback(multisig, data);
        }
      }
      const channel = await this.channelRepo.findByMultisigAddress(multisig);
      this.log.info(`Got channel ${multisig}: ${JSON.stringify(channel)}`);
      if (!channel) {
        this.log.error(`Acquiring a lock for a multisig w/out a channel: ${subject}`);
        return callback(multisig, data);
      }
      const { userPublicIdentifier } = channel;
      const xpubAddress = getAuthAddressFromXpub(userPublicIdentifier);
      this.log.debug(`Got address ${xpubAddress} from xpub ${userPublicIdentifier}`);
      const authRes = this.verifySig(xpubAddress, data);
      if (authRes) {
        this.log.error(
          `Auth failed (${authRes.err}) but we're just gonna ignore that for now..`,
        );
      }
      return callback(multisig, data);
    };
  }

  useUnverifiedMultisig(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const multisig = subject.split(".").pop(); // last item of subject is lock name
      if (!isEthAddress(multisig)) {
        return this.badSubject(`Subject's last item isn't a valid eth address: ${subject}`);
      }
      return callback(multisig, data);
    };
  }

  useUnverifiedHexString(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const lockName = subject.split(".").pop(); // last item of subject is lock name
      if (!isHexString(lockName)) {
        return this.badSubject(`Subject's last item isn't a valid hex string: ${subject}`);
      }
      return callback(lockName, data);
    };
  }

  useVerifiedPublicIdentifier(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      // // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return this.badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      const xpubAddress = getAuthAddressFromXpub(xpub);
      const authRes = this.verifySig(xpubAddress, data);
      if (authRes && subject.startsWith("channel.restore-states")) {
        this.log.error(
          `Auth failed (${authRes.err}) but we're just gonna ignore that for now..`,
        );
        return callback(xpub, data);
      }
      return authRes || callback(xpub, data);
    };
  }

  useAdminToken(callback: any): any {
    // get token from subject
    return async (subject: string, data: { token: string }): Promise<string> => {
      // // verify token is admin token
      const { token } = data;
      if (token !== process.env.INDRA_ADMIN_TOKEN) {
        return this.badToken(`Unrecognized admin token: ${token}.`);
      }
      return callback(data);
    };
  }

  useAdminTokenWithPublicIdentifier(callback: any): any {
    // get token from subject
    return async (subject: string, data: { token: string }): Promise<string> => {
      // // verify token is admin token
      const { token } = data;
      if (token !== process.env.INDRA_ADMIN_TOKEN) {
        return this.badToken(`Unrecognized admin token: ${token}.`);
      }

      // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return this.badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      return callback(xpub, data);
    };
  }

  useUnverifiedPublicIdentifier(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return this.badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      return callback(xpub, data);
    };
  }

  verifySig(xpubAddress: string, data: { token: string }): { err: string } | undefined {
    // Get & validate the nonce + signature from provided token
    if (!data || !data.token || data.token.indexOf(":") === -1) {
      return this.badToken(
        `Missing or malformed token in data: ${JSON.stringify(data || data.token)}`,
      );
    }
    const token = data.token;
    const nonce = token.split(":")[0];
    const sig = token.split(":")[1];
    if (!isValidHex(nonce, nonceLen) || !isValidHex(sig, 65)) {
      return this.badToken(`Improperly formatted nonce or sig in token: ${token}`);
    }

    // Get & validate expected address/expiry from local nonce storage
    if (!this.nonces[nonce] || !this.nonces[nonce].address || !this.nonces[nonce].expiry) {
      return this.badToken(`Unknown nonce provided by ${xpubAddress}: ${nonce}`);
    }
    const { address, expiry } = this.nonces[nonce];
    if (xpubAddress !== address) {
      return this.badToken(
        `Nonce ${nonce} for address ${address}, but xpub maps to ${xpubAddress}`,
      );
    }
    if (Date.now() >= expiry) {
      delete this.nonces[nonce];
      return this.badToken(`Nonce ${nonce} for ${address} expired at ${expiry}`);
    }

    // Cache sig recovery calculation
    if (!this.signerCache[token]) {
      this.signerCache[token] = verifyMessage(arrayify(nonce), sig);
      this.log.debug(`Recovered signer ${this.signerCache[token]} from token ${token}`);
    }
    const signer = this.signerCache[token];
    if (signer !== address) {
      return this.badToken(`Invalid sig for nonce ${nonce}: Got ${signer}, expected ${address}`);
    }
    return undefined;
  }
}
