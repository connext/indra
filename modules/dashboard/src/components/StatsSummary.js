import React, { useEffect, useState } from "react";
import { Grid, Typography, styled, Button, CircularProgress } from "@material-ui/core";
import { HashZero, WeiPerEther } from "ethers/constants";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
})

const StatTypography = styled(Typography)({
  textAlign: "center",
  width: "90%",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
})

const ErrorTypography = styled(Typography)({
  color: "red",
})


const address = {
  mainnet: "0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39", //"0xF80fd6F5eF91230805508bB28d75248024E50F6F", //,
  // staging: "0x0f41a9aaee33d3520f853cb706c24ca75cac874e",
  // rinkeby: "0x5307b4f67ca8746562a4a9fdeb0714033008ef4a",
};

const StatsSummary = ({ classes, messaging }) => {
  const [allChannels, setAllChannels] = useState(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [nodeTotal, setNodeTotal] = useState(0);
  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [valueReclaimable, setValueReclaimable] = useState(0)
  const [numberReclaimable, setNumberReclaimable] = useState(0)

  useEffect(() => {
    if (!messaging) {
      return;
    }
  });

  const onRefresh = async () => {
    await getChannels();
    // await getTransfers();
  };

  const getChannels = async () => {
    setLoading(true);
    try {
      const res = await messaging.getAllChannelStates();
      let xPubsToSearch = [];
      for (let row of res) {
        xPubsToSearch.push(row.userPublicIdentifier);
      }

      setAllChannels(xPubsToSearch);
      let channelTotalArr = [];
      let nodeChannelTotalArr = [];

      for (let xPub of xPubsToSearch) {
        const {currentChannelValue,currentNodeChannelValue}  = Promise.all([await getUserChannelAmount(xPub), await getNodeChannelAmount(xPub)])

        currentChannelValue !== 0 && channelTotalArr.push(currentChannelValue);
        currentNodeChannelValue !== 0 && nodeChannelTotalArr.push(currentNodeChannelValue);
      }
      var channelTotalArrReduced = channelTotalArr.reduce((a, b) => {
        return a + b;
      }, 0);
      var nodeChannelTotalArrReduced = nodeChannelTotalArr.reduce((a, b) => {
        return a + b;
      }, 0);

      setNodeTotal(nodeChannelTotalArrReduced);
      setChannelTotal(channelTotalArrReduced);
      setLoading(false);
      setSearchError(null);
    } catch (e) {
      setLoading(false);
      setSearchError(`error loading summary stats: ${e}`);
    }
  };

  const getUserChannelAmount = async xPub => {
    try {
      const res = await messaging.getStateChannelByUserPubId(xPub);
      let balanceArr = [];
      res.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
        if (balance.to !== address.mainnet) {
          balanceArr.push(parseInt(balance.amount._hex, 16));
        }
      });

      const balanceArrReduced = balanceArr.reduce((a, b) => {
        return a + b;
      }, 0);

      return balanceArrReduced;
    } catch (e) {
      setSearchError(`error getting channel: ${e}`);
    }
  };
  const getNodeChannelAmount = async xPub => {
    try {
      const res = await messaging.getStateChannelByUserPubId(xPub);
      let balanceArr = [];
      res.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
        if (balance.to === address.mainnet) {
          balanceArr.push(parseInt(balance.amount._hex, 16));
        }
      });

      const balanceArrReduced = balanceArr.reduce((a, b) => {
        return a + b;
      }, 0);

      return balanceArrReduced;
    } catch (e) {
      setSearchError(`error getting channel: ${e}`);
    }
  };

  const getTransfers = async () => {
    const res = await messaging.getAllLinkedTransfers() || [];

    const totalTransfers = [];
    const totalTransfersReduced = 0;
    if (res) {
      await getReclaimableTransfers(res)
      for (let transfer of res) {
        totalTransfers.push(parseInt(transfer.amount._hex, 16));
      }
      totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a + b;
      }, 0);
    }
    const averageTransfer = totalTransfersReduced / res.length / WeiPerEther;
    setAverageTransfer(averageTransfer);
    setAllTransfers(res);
  };

  const getReclaimableTransfers = async (allTransfers) => {

    let reclaimableValue = [];
    if (allTransfers && allTransfers.length >0) {
      for (let transfer of allTransfers) {
        if(transfer.status !== "PENDING" && transfer.status !== "REDEEMED"){
          reclaimableValue.push(parseInt(transfer.amount._hex, 16));
        }
      }
      var reclaimableValueReduced = reclaimableValue.reduce((a, b) => {
        return a + b;
      }, 0);
      var totalValueReclaimable = reclaimableValueReduced / WeiPerEther;
      setNumberReclaimable(allTransfers.length);
      setValueReclaimable(totalValueReclaimable)
    }

  };

  return (
    <TopGrid  container>
      <Button
        onClick={async () => {
          await onRefresh();
        }}
      >
        Refresh stats
      </Button>
      <Grid>
        <ErrorTypography >{searchError}</ErrorTypography>
      </Grid>
      {loading ? (
        <CircularProgress color="secondary" />
      ) : (
        <Grid container>
          <StatTypography>
            total channels: {allChannels ? allChannels.length : 0}
          </StatTypography>
          <StatTypography >
            collateral ratio: {JSON.stringify(nodeTotal / channelTotal)}
          </StatTypography>
          <StatTypography >
            TVL:payment volume:{" "}
            {nodeTotal && allTransfers && allTransfers.length > 0
              ? (nodeTotal/WeiPerEther) / allTransfers.length
              : 0}
          </StatTypography>

          <StatTypography>
            total user balances: {JSON.stringify(channelTotal / WeiPerEther)}
          </StatTypography>
          <StatTypography>
            average transfer: {averageTransfer}
          </StatTypography>
          <StatTypography >
            total node balances: {JSON.stringify(nodeTotal / WeiPerEther)}
          </StatTypography>
          <StatTypography >
            number of reclaimable payments: {JSON.stringify(numberReclaimable)}
          </StatTypography>

          <StatTypography >
            value of reclaimable payments: {JSON.stringify(valueReclaimable)}
          </StatTypography>
        </Grid>
      )}
    </TopGrid>
  );
};

export default StatsSummary;
