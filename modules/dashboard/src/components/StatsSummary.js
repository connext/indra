import React, { useEffect, useState } from "react";
import { Grid, Typography, withStyles } from "@material-ui/core";
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
};

const StatsSummary = props => {
  const { classes, messaging, token } = props;

  const [allChannels, setAllChannels] = useState(null);
  const [channelTotal, setChannelTotal] = useState(0);

  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => {
      const getChannels = async () => {
        var res = await messaging.request("admin.get-all-channel-states", 5000, {
          token: token,
        });

        let xPubsToSearch = [];
        Object.values(res)[0].response.forEach(row => {
          xPubsToSearch.push(row.userPublicIdentifier);
        });

        setAllChannels(xPubsToSearch);
        let channelTotalArr = [];
        xPubsToSearch.forEach(async xPub => {
          var currentChannelValue = await getChannelAmount(xPub);
          currentChannelValue !== 0 && channelTotalArr.push(currentChannelValue);
        });
        var channelTotalArrReduced = channelTotalArr.reduce((a, b) => {
          return a + b;
        }, 0);
        return channelTotalArrReduced
      };
      var channelTotalArrReduced = await getChannels();
      setChannelTotal(channelTotalArrReduced);
    })();
  });

  const getChannelAmount = async xPub => {
    var res = await messaging.request("admin.get-channel-states", 5000, {
      token: token,
      id: xPub,
    });

    var extractedValues = Object.values(res)[0].response;
    let balanceArr = [];
    extractedValues.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
      balanceArr.push(parseInt(balance.amount._hex, 16));
    });

    var balanceArrReduced = balanceArr.reduce((a, b) => {
      return a + b;
    }, 0);

    return balanceArrReduced;
  };

  return (
    <Grid className={classes.top} container>
      {/* <Typography className={classes.cardText}>{JSON.stringify(allChannels)}</Typography> */}
      <Typography className={classes.cardText}>
        total value locked: {JSON.stringify(channelTotal)}
      </Typography>
    </Grid>
  );
};

StatsSummary.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(StatsSummary);
