import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ethers as eth } from "ethers";
import {
  arrayify,
  hexlify,
  isHexString,
  randomBytes,
  toUtf8Bytes,
  verifyMessage,
} from "ethers/utils";
import { Redis } from "ioredis";

import { RedisProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("AuthService");

const isValidHex = (hex: string, length: number): boolean =>
  isHexString(hex) && arrayify(hex).length === length;

const nonceExpiry = 1000 * 60 * 60 * 2; // 2 hours

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@Inject(RedisProviderId) private readonly redis: Redis) {}

  onModuleInit = (): void => {};

  async getNonce(address: string): Promise<string> {
    if (!isValidHex(address, 20)) {
      return JSON.stringify({ err: "Invalid address" });
    }
    const nonce = eth.utils.hexlify(eth.utils.randomBytes(32));
    await this.redis.set(`nonce:${address}`, nonce);
    logger.log(`Set nonce ${nonce} for address ${address}`);
    return JSON.stringify({ nonce: hexlify(randomBytes(32)) });
  }

  getAuthMiddleware = (config: any, acl: any): any => async (
    req: any,
    res: any,
    next: () => void,
  ): Promise<void> => {
    const address = req.get("x-address");
    const nonce = req.get("x-nonce");
    const signature = req.get("x-signature");
    const authorization = req.get("authorization");

    const redis = {} as any;

    req.address = address;
    req.roles = [];

    // Skip auth checks if requesting unpermissioned route
    if (acl.permissionForRoute(req.path) === "NONE") {
      logger.debug(`Route ${req.path} doesn't require any permissions, skipping authentication`);
      next();
      return;
    }

    // Check whether we should auth service key against bearer authorization header
    if (config.serviceKey && authorization) {
      const authHeaderParts = authorization.split(" ");
      if (authHeaderParts.length !== 2 || authHeaderParts[0].toLowerCase() !== "bearer") {
        logger.warn(`Malformed bearer authorization header`);
        res.status(403).send(`Malformed bearer authorization header`);
        return;
      }

      const serviceKey = authHeaderParts[1];
      if (config.serviceKey === serviceKey) {
        req.roles.push("AUTHENTICATED");
        req.roles.push("SERVICE");
        logger.log(`Successfully authenticated service key for user ${address}`);
      } else {
        logger.warn(`Service key provided by ${address} doesn't match the one set in hub config`);
        res.status(403).send(`Invalid service key`);
        return;
      }

      // Check whether we should auth via signature verification headers
    } else if (isValidHex(address, 20) && isValidHex(nonce, 32) && isValidHex(signature, 65)) {
      try {
        // TODO: Why aren't redis errors hitting the catch block?!
        const expectedNonce = await redis.get(`nonce:${address}`);
        if (!expectedNonce) {
          logger.warn(`No nonce available for address ${address}`);
          res.status(403).send(`Invalid nonce`);
          return;
        }
        if (expectedNonce !== nonce) {
          logger.warn(
            `Invalid nonce for address ${address}: Got ${nonce}, expected ${expectedNonce}`,
          );
          res.status(403).send(`Invalid nonce`);
          return;
        }
        // check whether this nonce has expired // TODO check if sig has expired
        const nonceTimestamp = (await redis.get(`nonce-timestamp:${address}`)) || "0";
        const nonceAge = Date.now() - parseInt(nonceTimestamp, 10);
        logger.debug(`Nonce for ${address} was created ${nonceAge} ms ago`);
        if (nonceAge > nonceExpiry) {
          logger.warn(`Invalid nonce for ${address}: expired ${nonceAge - nonceExpiry} ms ago`);
          res.status(403).send(`Invalid nonce`);
          return;
        }
      } catch (e) {
        logger.warn(`Not connected to redis ${config.redisUrl}`);
        res.status(500).send(`Server Error`);
        return;
      }

      // Have we cached the verification for this signature?
      const cachedSig = await redis.get(`signature:${address}`);
      if (!cachedSig) {
        const bytes = isHexString(nonce) ? arrayify(nonce) : toUtf8Bytes(nonce);
        const signer = verifyMessage(bytes, signature).toLowerCase();
        if (signer !== address.toLowerCase()) {
          logger.warn(`Invalid sig for nonce "${nonce}": Got "${signer}", expected "${address}"`);
          res.status(403).send("Invalid signature");
          return;
        }
        await redis.set(`signature:${address}`, signature);
      } else if (cachedSig && cachedSig !== signature) {
        logger.warn(
          `Invalid signature for address "${address}": Doesn't match cache: ${cachedSig}`,
        );
        res.status(403).send("Invalid signature");
        return;
      }
      req.roles.push("AUTHENTICATED");
      logger.debug(`Successfully authenticated signature for ${address}`);
    } else {
      logger.warn(`Invalid auth headers: address=${address} nonce=${nonce} sig=${signature}`);
      res.status(403).send(`Invalid auth headers`);
      return;
    }

    // Check if we should also assign an admin role
    if (config.adminAddresses.indexOf(address) > -1) {
      req.roles.push("ADMIN");
      logger.log(`Admin role added for user ${address}`);
    }

    // Given the set roles, do we have permission to access this route?
    const perm = acl.permissionForRoute(req.path);
    if (req.roles.indexOf(perm) === -1) {
      const roleStrings = JSON.stringify(req.roles.map((role: number): string => "NONE"));
      logger.warn(`${address} ${roleStrings} is missing ? role for route ${req.path}`);
      res.status(403).send(`You don't have the required role: ?}`);
      return;
    }

    next();
    return;
  };
}
