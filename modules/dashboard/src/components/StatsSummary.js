import React, { useEffect, useState } from "react";
import { Grid, Typography, styled, Button, CircularProgress } from "@material-ui/core";
import { HashZero } from "ethers/constants";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "flex-start",
  alignItems: "center",
});

const StatLabelTypography = styled(Typography)({
  alignSelf: "center",
  textAlign: "left",
  fontSize: "24px",
  fontWeight: "600",
  color: "#002868",
  textDecoration: "none",
});

const StatTypography = styled(Typography)({
  fontSize: "24px",
  fontWeight: "400",
});

const ErrorTypography = styled(Typography)({
  color: "red",
});

const RefreshButton = styled(Button)({
  marginLeft: "5%",
});

const SectionGrid = styled(Grid)({
  marginLeft:"5%"
})

const address = {
  mainnet: "0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39", //"0xF80fd6F5eF91230805508bB28d75248024E50F6F", //,
  staging: "0x5307B4F67ca8746562A4a9fdEb0714033008Ef4A",
  // rinkeby: "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c",
};

const StatsSummary = ({ classes, messaging }) => {
  const [allChannels, setAllChannels] = useState(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [nodeTotal, setNodeTotal] = useState(0);
  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [transferWindows, setTransferWindows] = useState({});

  useEffect(() => {
    if (!messaging) {
      return;
    }
  });

  const onRefresh = async () => {
    console.log("refreshing!");
    // await messaging.getLinkedTransferByPaymentId(HashZero);
    await getChannels();
    await getTransfers();
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
        const currentChannelValue = await getUserChannelAmount(xPub);
        const currentNodeChannelValue = await getNodeChannelAmount(xPub);

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
        if (balance.to !== address.staging) {
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
        if (balance.to === address.staging) {
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
    const res = (await messaging.getAllLinkedTransfers()) || [];

    let totalTransfers = [];
    let pastDayTotal = 0,
      pastWeekTotal = 0,
      pastMonthTotal = 0;
    if (res) {
      for (let transfer of res) {
        totalTransfers.push(parseInt(transfer.amount._hex, 16));
        const createdDate = new Date(transfer.createdAt);
        const hourDifference = (Date.now() - createdDate.getTime()) / 3600000;
        if (hourDifference <= 24) {
          pastDayTotal++;
        } else if (hourDifference > 24 && hourDifference <= 168) {
          pastWeekTotal++;
        } else if (hourDifference > 168 && hourDifference <= 720) {
          pastMonthTotal++;
        }
      }
      var totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a + b;
      }, 0);
    }
    var averageTransfer = totalTransfersReduced / res.length / 1000000000000000000;
    setTransferWindows({ pastDayTotal, pastWeekTotal, pastMonthTotal });
    setAverageTransfer(averageTransfer);
    setAllTransfers(res);
  };

  return (
    <TopGrid container>
      <RefreshButton
        onClick={async () => {
          await onRefresh();
        }}
      >
        Refresh stats
      </RefreshButton>
      <Grid>
        <ErrorTypography>{searchError}</ErrorTypography>
      </Grid>
      {loading ? (
        <CircularProgress color="secondary" />
      ) : (
        <SectionGrid container xs={12}>
          <Grid xs={3}>
            <StatLabelTypography>
              total channels:{" "}
              <StatTypography>{allChannels ? allChannels.length : 0}</StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              collateral ratio:{" "}
              <StatTypography>{(nodeTotal / channelTotal).toFixed(2)}</StatTypography>
            </StatLabelTypography>
          </Grid>
          <Grid xs={4}>
            <StatLabelTypography>
              TVL:payment volume (all time):{" "}
              <StatTypography>
                {nodeTotal && allTransfers && allTransfers.length > 0
                  ? (nodeTotal / 1000000000000000000 / allTransfers.length).toFixed(2)
                  : 0}
              </StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              TVL:payment volume (trailing day):{" "}
              <StatTypography>
                {nodeTotal && transferWindows && transferWindows.pastDayTotal > 0
                  ? (nodeTotal / 1000000000000000000 / transferWindows.pastDayTotal).toFixed(2)
                  : 0}
              </StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              TVL:payment volume (trailing week):{" "}
              <StatTypography>
                {nodeTotal && transferWindows && transferWindows.pastWeekTotal > 0
                  ? (nodeTotal / 1000000000000000000 / transferWindows.pastWeekTotal).toFixed(2)
                  : 0}
              </StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              TVL:payment volume (trailing month):{" "}
              <StatTypography>
                {nodeTotal && transferWindows && transferWindows.pastMonthTotal > 0
                  ? (nodeTotal / 1000000000000000000 / transferWindows.pastMonthTotal).toFixed(2)
                  : 0}
              </StatTypography>
            </StatLabelTypography>
          </Grid>
          <Grid xs={4}>
            <StatLabelTypography>
              total user balances:{" "}
              <StatTypography>{(channelTotal / 1000000000000000000).toFixed(2)}</StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              average transfer: <StatTypography>{averageTransfer.toFixed(2)}</StatTypography>
            </StatLabelTypography>
            <StatLabelTypography>
              total node balances:{" "}
              <StatTypography>{(nodeTotal / 1000000000000000000).toFixed(2)}</StatTypography>
            </StatLabelTypography>
          </Grid>
        </SectionGrid>
      )}
    </TopGrid>
  );
};

export default StatsSummary;
