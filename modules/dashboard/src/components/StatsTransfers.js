import React, { useState } from "react";
import { Button, Grid, Typography, styled } from "@material-ui/core";
import PropTypes from "prop-types";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
});

const StatTypography = styled(Typography)({
  textAlign: "center",
  width: "90%",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
});

const ErrorTypography = styled(Typography)({
  color: "red",
});

const StatsTransfers = props => {
  const { classes, messaging } = props;

  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0);

  // useEffect(() => {
  // }, []);

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
      <Grid>
        <StatTypography >
          total transfers: {allTransfers ? allTransfers.length : 0}
        </StatTypography>
        <StatTypography >
          average transfer size: {averageTransfer ? averageTransfer : 0}
        </StatTypography>
        {/* <Typography className={classes.cardText}>
            total transfers: {allTransfers ? JSON.stringify(allTransfers) : 0}
      </Typography> */}
      </Grid>
    </TopGrid>
  );
};

export default StatsTransfers;
