import { AbstractController } from "./AbstractController";
import {
  PublicParams,
  PublicResults,
  ConditionalTransferTypes,
  GraphMultiTransferAppAction,
  GraphActionType,
  AppInstanceJson,
  GenericConditionalTransferAppState,
  EventPayloads,
  GraphMultiTransferAppState,
  EventNames,
} from "@connext/types";
import { stringify, toBN } from "@connext/utils";
import { constants, utils } from "ethers";
import { hexZeroPad } from "ethers/lib/utils";
const { hexlify, zeroPad } = utils;
const { HashZero, Zero } = constants;

export class UpdateTransferController extends AbstractController {
  public updateTransfer = async (
    params: PublicParams.UpdateConditionalTransfer,
  ): Promise<PublicResults.UpdateConditionalTransfer> => {
    this.log.info(`conditionalTransfer started: ${stringify(params)}`);

    const { conditionType, paymentId } = params;

    // helper fns
    const appDefinition = this.connext.appRegistry.find((app) => app.name === conditionType)
    .appDefinitionAddress;

    const findApp = (apps: AppInstanceJson[]) => {
        return apps.find((app) => {
            return(
                app.appDefinition === appDefinition && 
                app.meta.paymentId === paymentId
            )
        });
    };

    let action: GraphMultiTransferAppAction;

    switch (conditionType) {
      case ConditionalTransferTypes.GraphMultiTransfer: {
        const {
            actionType,
            requestCID,
            price,
            responseCID,
            signature,
        } = params as PublicParams.UpdateGraphMultiTransfer;

        action = {
            actionType,
            requestCID: requestCID || HashZero,
            price: price ? toBN(price) : Zero,
            responseCID: responseCID || HashZero,
            signature: signature || hexZeroPad(hexlify(0), 65)
        }
        break;
      }
      default: {
        const c: never = conditionType;
        this.log.error(`Invalid condition type ${c}`);
      }
    }

    const app = findApp(await this.connext.getAppInstances());
    if(!app) {
        throw new Error(`No app found for paymentId: ${paymentId} and appDefinition: ${appDefinition}`)
    }

    this.log.debug(`Taking action on app with conditionType: ${conditionType}`)
    const newState = (await this.connext.takeAction(app.identityHash, action)).newState as GraphMultiTransferAppState;
    
    // Emit event
    const eventData = {
        type: conditionType,
        paymentId,
        newState,
        action
      } as EventPayloads.GraphMultiTransferUpdated;
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_UPDATED_EVENT, eventData);

      // Return result
      const result: PublicResults.UpdateConditionalTransfer = {
        paymentId,
        newState,
        action
      };
      this.log.info(
        `conditionalTransfer ${conditionType} for paymentId ${
          paymentId
        } complete: ${JSON.stringify(result)}`,
      );
      return result;
  };
}
