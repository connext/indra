import React, { useEffect, useState } from "react";
import { Grid, Typography, styled, Button, CircularProgress } from "@material-ui/core";
import { HashZero } from "ethers/constants";

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

  useEffect(() => {
    if (!messaging) {
      return;
    }
  });

  const onRefresh = async () => {
    console.log("refreshing!");
    const res = await messaging.getLinkedTransferByPaymentId(HashZero);
    console.log(res);
    await getChannels();
    await getTransfers();
  };

  const getChannels = async () => {
    setLoading(true);
    try {
      const res = await messaging.getAllChannelStates();
      console.log("Res", res);
      let xPubsToSearch = [];
      for (let row of res) {
        xPubsToSearch.push(row.userPublicIdentifier);
      }

      console.log(xPubsToSearch);

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
    const res = await messaging.getAllLinkedTransfers();

    let totalTransfers = [];
    if (res) {
      for (let transfer of res) {
        totalTransfers.push(parseInt(transfer.amount._hex, 16));
      }
      var totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a + b;
      }, 0);
    }
    var averageTransfer = totalTransfersReduced / res.length / 1000000000000000000;

    setAverageTransfer(averageTransfer);
    setAllTransfers(res);
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
              ? (nodeTotal/1000000000000000000) / allTransfers.length
              : 0}
          </StatTypography>

          <StatTypography>
            total user balances: {JSON.stringify(channelTotal / 1000000000000000000)}
          </StatTypography>
          <StatTypography>
            average transfer: {averageTransfer}
          </StatTypography>
          <StatTypography >
            total node balances: {JSON.stringify(nodeTotal / 1000000000000000000)}
          </StatTypography>
        </Grid>
      )}
    </TopGrid>
  );
};

export default StatsSummary;
