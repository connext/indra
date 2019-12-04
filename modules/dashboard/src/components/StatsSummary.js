import React, { useEffect, useState } from "react";
import { Grid, Typography, withStyles, Button, CircularProgress } from "@material-ui/core";
import PropTypes from "prop-types";
import { bigNumberify, toNumber, toString } from "ethers/utils";

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
    width: "90%",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
  },
  error: {
    color: "red",
  },
};

const StatsSummary = props => {
  const { classes, messaging, token } = props;

  const [allChannels, setAllChannels] = useState(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (!messaging) {
      return;
    }
  });

  const onRefresh = async () => {
    console.log("refreshing!");
    await getChannels();
  };

  const getChannels = async () => {
    setLoading(true);
    try {
      var res = await messaging.request("admin.get-all-channel-states", 5000, {
        token: token,
      });

      let xPubsToSearch = [];
      Object.values(res)[0].response.forEach(row => {
        xPubsToSearch.push(row.userPublicIdentifier);
      });

      console.log(xPubsToSearch)

      setAllChannels(xPubsToSearch);
      let channelTotalArr = [];

      for (let xPub of xPubsToSearch) {
        var currentChannelValue = await getChannelAmount(xPub);
        currentChannelValue !== 0 && channelTotalArr.push(currentChannelValue);
      }
      var channelTotalArrReduced = channelTotalArr.reduce((a, b) => {
        return a + b;
      }, 0);
      setChannelTotal(channelTotalArrReduced);
      setLoading(false);
      setSearchError(null);
    } catch (e) {
      setLoading(false);
      setSearchError(`error loading summary stats: ${e}`);
    }
  };

  const getChannelAmount = async xPub => {
  console.log("xpub: ", xPub)
    try{
    var res = await messaging.request("get-channel-state-by-xpub", 5000, {
      token: token,
      id: xPub,
    });
    console.log(res)

    var extractedValues = Object.values(res)[0].response;
    console.log(extractedValues)
    let balanceArr = [];
    extractedValues.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
      balanceArr.push(parseInt(balance.amount._hex, 16));
    });

    var balanceArrReduced = balanceArr.reduce((a, b) => {
      return a + b;
    }, 0);

    return balanceArrReduced;
  }catch{
    console.log("ERROR GETTING CHANNEL")
  }
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
        <Typography className={classes.error}>{searchError}</Typography>
      </Grid>
      {loading ? (
        <CircularProgress color="secondary" />
      ) : (
        <Grid container>
          <Typography className={classes.cardText}>
            total channels: {allChannels ? allChannels.length : 0}
          </Typography>
          <Typography className={classes.cardText}>
            total free balances: {JSON.stringify(channelTotal/1000000000000000000)}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

StatsSummary.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(StatsSummary);
