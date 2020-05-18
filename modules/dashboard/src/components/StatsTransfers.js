import React, { useState } from "react";
import { Button, Grid, Typography, styled } from "@material-ui/core";
import { constants } from "ethers";

const { WeiPerEther } = constants;

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  paddingLeft: "5%",
  justifyContent: "flex-start",
  alignItems: "flex-start",
});

const SectionWrapper = styled(Grid)({
  marginTop: "1%",
  marginBottom: "1%",
  width: "30%",
});

const StatTypography = styled(Typography)({
  textAlign: "left",
  width: "90%",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
});

const HeaderTypography = styled(Typography)({
  textAlign: "left",
  width: "90%",
  fontSize: "30px",
  color: "#002868",
  fontStyle: "underline",
});

const StatsTransfers = (props) => {
  const { messaging } = props;

  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0);
  const [transferDateWindows, setTransferDateWindows] = useState({});

  // useEffect(() => {
  // }, []);

  const getTransfers = async () => {
    const res = await messaging.getAllLinkedTransfers();

    let totalTransfers = [];
    let pastDayTotal = 0,
      pastWeekTotal = 0,
      pastMonthTotal = 0;
    let pastDayAvg = [],
      pastWeekAvg = [],
      pastMonthAvg = [];

    let pastDayReduced;
    let pastWeekReduced;
    let pastMonthReduced;
    let totalTransfersReduced;

    if (res) {
      for (let transfer of res) {
        totalTransfers.push(parseInt(transfer.amount._hex, 16));
        const createdDate = new Date(transfer.createdAt);
        const hourDifference = (Date.now() - createdDate.getTime()) / 3600000;

        if (hourDifference <= 24) {
          pastDayTotal++;
          pastDayAvg.push(parseInt(transfer.amount._hex, 16));
        }
        if (hourDifference <= 168) {
          pastWeekTotal++;
          pastWeekAvg.push(parseInt(transfer.amount._hex, 16));
        }
        if (hourDifference <= 720) {
          pastMonthTotal++;
          pastMonthAvg.push(parseInt(transfer.amount._hex, 16));
        }
      }
      pastDayReduced = pastDayAvg.reduce((a, b) => {
        return a + b;
      }, 0);
      pastWeekReduced = pastWeekAvg.reduce((a, b) => {
        return a + b;
      }, 0);
      pastMonthReduced = pastMonthAvg.reduce((a, b) => {
        return a + b;
      }, 0);

      totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a + b;
      }, 0);
    }
    let averageTransfer = totalTransfersReduced / res.length / WeiPerEther;
    let averageTransferDay = pastDayReduced / pastDayAvg.length / WeiPerEther;
    let averageTransferWeek = pastWeekReduced / pastWeekAvg.length / WeiPerEther;
    let averageTransferMonth = pastMonthReduced / pastMonthAvg.length / WeiPerEther;

    let transferDateWindows = {
      pastDayTotal: pastDayTotal,
      averageTransferDay: averageTransferDay.toFixed(2),
      pastWeekTotal: pastWeekTotal,
      averageTransferWeek: averageTransferWeek.toFixed(2),
      pastMonthTotal: pastMonthTotal,
      averageTransferMonth: averageTransferMonth.toFixed(2),
    };
    setTransferDateWindows(transferDateWindows);
    setAverageTransfer(averageTransfer.toFixed(2));
    setAllTransfers(res);
  };

  const onRefresh = async () => {
    console.log("refreshing!");
    await getTransfers();
  };

  return (
    <TopGrid container>
      <Button
        onClick={async () => {
          await onRefresh();
        }}
      >
        Refresh stats
      </Button>
      <SectionWrapper>
        <HeaderTypography>All time</HeaderTypography>
        <StatTypography>{allTransfers ? allTransfers.length : 0} total transfers</StatTypography>
        <StatTypography>${averageTransfer ? averageTransfer : 0} average</StatTypography>
      </SectionWrapper>
      <SectionWrapper>
        <HeaderTypography>Past Day</HeaderTypography>
        <StatTypography>
          {transferDateWindows ? transferDateWindows.pastDayTotal : 0} total transfers
        </StatTypography>
        <StatTypography>
          ${transferDateWindows ? transferDateWindows.averageTransferDay : 0} average
        </StatTypography>
      </SectionWrapper>
      <SectionWrapper>
        <HeaderTypography>Past Week</HeaderTypography>
        <StatTypography>
          ${transferDateWindows ? transferDateWindows.pastWeekTotal : 0} total transfers
        </StatTypography>
        <StatTypography>
          ${transferDateWindows ? transferDateWindows.averageTransferWeek : 0} average
        </StatTypography>
      </SectionWrapper>
      <SectionWrapper>
        <HeaderTypography>Past Month</HeaderTypography>
        <StatTypography>
          {transferDateWindows ? transferDateWindows.pastMonthTotal : 0} total transfers
        </StatTypography>
        <StatTypography>
          ${transferDateWindows ? transferDateWindows.averageTransferMonth : 0} average
        </StatTypography>
      </SectionWrapper>
    </TopGrid>
  );
};

export default StatsTransfers;
