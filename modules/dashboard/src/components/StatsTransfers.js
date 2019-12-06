import React, { useEffect, useState } from "react";
import { Button,Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginTop: "15%",
    display: "flex",
    height: "320px",
    width: "320px",
    alignItems: "center",
    justifyContent: "center",
    margin: "0% 2% 0% 2%",
    border: "3px solid #002868",
    textDecoration: "none",
    "&:hover": { backgroundColor: "rgba(0,40,104,0.2)" },
  },
  cardText: {
    textAlign: "center",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
  },
};

const  StatsTransfers = props=> {
  const {classes, messaging} = props;


  const [allTransfers, setAllTransfers] = useState(null);
  const [averageTransfer, setAverageTransfer] = useState(0)

  // useEffect(() => {
  // }, []);

  const getTransfers = async () => {
      const res = await messaging.getAllLinkedTransfers();

      let totalTransfers = []; 
      if(res){
        for (let transfer of res){
        totalTransfers.push(parseInt(transfer.amount._hex, 16));
      }
      var totalTransfersReduced = totalTransfers.reduce((a, b) => {
        return a + b;
        }, 0);
      }
      var averageTransfer = (totalTransfersReduced / res.length) / 1000000000000000000

      setAverageTransfer(averageTransfer)
      setAllTransfers(res);
  };

  const onRefresh = async () => {
    console.log("refreshing!");
    await getTransfers();
  };

  return (
    <Grid className={classes.top} container>
    <Button
        onClick={async () => {
          await onRefresh();
        }}
      >
        Refresh stats
      </Button>
      <Grid>
      <Typography className={classes.cardText}>
            total transfers: {allTransfers ? allTransfers.length : 0}
      </Typography>
      <Typography className={classes.cardText}>average transfer size: {averageTransfer? averageTransfer:0}</Typography>
      {/* <Typography className={classes.cardText}>
            total transfers: {allTransfers ? JSON.stringify(allTransfers) : 0}
      </Typography> */}
      </Grid>
    </Grid>
  );
}

StatsTransfers.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(StatsTransfers);
