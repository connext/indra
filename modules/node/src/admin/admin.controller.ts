import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  NotFoundException,
  Get,
  Param,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "../config/config.service";

import { AdminService } from "./admin.service";
import { RebalanceProfile } from "@connext/types";
import { ChannelService } from "../channel/channel.service";
import { ChannelRepository } from "../channel/channel.repository";
import { BigNumber } from "ethers";

export class UninstallDepositAppDto {
  multisigAddress!: string;
  assetId?: string;
}

export class AddRebalanceProfileDto {
  multisigAddress!: string;
  rebalanceProfile!: RebalanceProfile;
}

@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    private readonly channelService: ChannelService,
    private readonly channelRepository: ChannelRepository,
  ) {}

  @Post("uninstall-deposit")
  async uninstallDepositApp(
    @Body() { multisigAddress, assetId }: UninstallDepositAppDto,
    @Headers("x-auth-token") token: string,
  ): Promise<string | undefined> {
    if (token !== this.configService.getAdminToken()) {
      throw new UnauthorizedException();
    }
    try {
      const res = await this.adminService.uninstallDepositAppForChannel(multisigAddress, assetId);
      return res;
    } catch (e) {
      if (e.message.includes("Channel does not exist for multisig")) {
        throw new NotFoundException("Channel not found");
      }
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post("rebalance-profile")
  async addRebalanceProfile(
    @Body() { multisigAddress, rebalanceProfile }: AddRebalanceProfileDto,
    @Headers("x-auth-token") token: string,
  ): Promise<RebalanceProfile> {
    // not ideal to do this everywhere, can be refactored into a "guard" (see nest docs)
    if (token !== this.configService.getAdminToken()) {
      throw new UnauthorizedException();
    }
    try {
      const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      const res = await this.channelService.addRebalanceProfileToChannel(
        channel.userIdentifier,
        channel.chainId,
        {
          ...rebalanceProfile,
          collateralizeThreshold: BigNumber.from(rebalanceProfile.collateralizeThreshold),
          target: BigNumber.from(rebalanceProfile.target),
          reclaimThreshold: BigNumber.from(rebalanceProfile.reclaimThreshold),
        },
      );
      return {
        assetId: res.assetId,
        collateralizeThreshold: res.collateralizeThreshold.toString(),
        target: res.target.toString(),
        reclaimThreshold: res.reclaimThreshold.toString(),
      } as any;
    } catch (e) {
      if (e.message.includes("Channel does not exist for multisig")) {
        throw new NotFoundException("Channel not found");
      }
      throw new InternalServerErrorException(e.message);
    }
  }

  @Get("rebalance-profile/:multisigAddress/:assetId")
  async getRebalanceProfile(
    @Param("multisigAddress") multisigAddress: string,
    @Param("assetId") assetId: string,
    @Headers("x-auth-token") token: string,
  ): Promise<RebalanceProfile> {
    // not ideal to do this everywhere, can be refactored into a "guard" (see nest docs)
    if (token !== this.configService.getAdminToken()) {
      throw new UnauthorizedException();
    }
    try {
      const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
      let res = await this.channelRepository.getRebalanceProfileForChannelAndAsset(
        channel.userIdentifier,
        channel.chainId,
        assetId,
      );
      if (!res) {
        res = this.configService.getDefaultRebalanceProfile(assetId);
      }
      if (!res) {
        throw new NotFoundException("Rebalance profile not found");
      }
      return {
        assetId: res.assetId,
        collateralizeThreshold: res.collateralizeThreshold.toString(),
        target: res.target.toString(),
        reclaimThreshold: res.reclaimThreshold.toString(),
      } as any;
    } catch (e) {
      if (e.message.includes("Channel does not exist for multisig")) {
        throw new NotFoundException("Channel not found");
      }
      throw new InternalServerErrorException(e.message);
    }
  }
}
