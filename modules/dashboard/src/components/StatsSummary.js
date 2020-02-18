import React, { useEffect, useState } from "react";
import { Grid, Typography, styled, Button, CircularProgress } from "@material-ui/core";
import { HashZero, WeiPerEther } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

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
  marginLeft: "5%",
});

const address = {
  mainnet: "0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39", //"0xF80fd6F5eF91230805508bB28d75248024E50F6F", //,
  staging: "0x5307B4F67ca8746562A4a9fdEb0714033008Ef4A",
  // rinkeby: "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c",
};

const EthWeiConversion = new BigNumber(WeiPerEther)

const StatsSummary = ({ classes, messaging }) => {
  const [allChannels, setAllChannels] = useState(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [nodeTotal, setNodeTotal] = useState(new BigNumber(0));
  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [valueReclaimable, setValueReclaimable] = useState(new BigNumber(0))
  const [numberReclaimable, setNumberReclaimable] = useState(new BigNumber(0))
  const [transferWindows, setTransferWindows] = useState({});

  useEffect(() => {
    if (!messaging) {
      return;
    }
  });

  const onRefresh = async () => {
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

        const {currentChannelValue,currentNodeChannelValue}  = Promise.all([await getUserChannelAmount(xPub), await getNodeChannelAmount(xPub)])
        currentChannelValue && currentChannelValue !== 0 && channelTotalArr.push(new BigNumber(currentChannelValue));
        currentNodeChannelValue && currentNodeChannelValue !== 0 && nodeChannelTotalArr.push(new BigNumber(currentNodeChannelValue));
      }
      var channelTotalArrReduced = channelTotalArr.reduce((a, b) => {
        return (a.add(b)).div(EthWeiConversion);
      }, 0);
      var nodeChannelTotalArrReduced = nodeChannelTotalArr.reduce((a, b) => {
        return (a.add(b)).div(EthWeiConversion);
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
      console.warn(balanceArrReduced)
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
    let totalTransfersReduced;
    if (res) {
      await getReclaimableTransfers(res)
      for (let transfer of res) {
        totalTransfers.push(bigNumberify(transfer.amount._hex));
      }
      totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a.add(b);
      }, 0);
    }
    const averageTransfer = totalTransfersReduced.div(res.length.mul(EthWeiConversion))
    setAverageTransfer(averageTransfer);
    setAllTransfers(res);
  };

  const getReclaimableTransfers = async (allTransfers) => {

    let reclaimableValue = [];
    if (allTransfers && allTransfers.length >0) {
      for (let transfer of allTransfers) {
        if(transfer.status !== "PENDING" && transfer.status !== "REDEEMED"){
          reclaimableValue.push(bigNumberify(transfer.amount._hex));
        }
      }
      console.warn(reclaimableValue)
      var reclaimableValueReduced = reclaimableValue.reduce((a, b) => {
        console.warn(typeof a)
        return (a.add(b)).div(EthWeiConversion);
      }, 0);
      setNumberReclaimable(allTransfers.length);
      setValueReclaimable(reclaimableValueReduced)
    }

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
        <Grid container>
          <StatTypography>
            total channels: {allChannels ? allChannels.length : 0}
          </StatTypography>
          {/* <StatTypography >
            collateral ratio: {channelTotal.isZero()? 0: nodeTotal.div(channelTotal)}
          </StatTypography> */}
          <StatTypography >
            TVL:payment volume:{" "}
            {nodeTotal && allTransfers && allTransfers.length > 0
              ? (nodeTotal/WeiPerEther) / allTransfers.length
              : 0}
          </StatTypography>

          <StatTypography>
            total user balances: {channelTotal.toString()}
          </StatTypography>
          <StatTypography>
            average transfer: {averageTransfer}
          </StatTypography>
          <StatTypography >
            total node balances: {nodeTotal.toString()}
          </StatTypography>
          <StatTypography >
            number of reclaimable payments: {numberReclaimable.toString()}
          </StatTypography>

          <StatTypography >
            value of reclaimable payments: {valueReclaimable.toString()}
          </StatTypography>
        </Grid>
      )}
    </TopGrid>
  );
};

export default StatsSummary;
