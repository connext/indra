import React, { useEffect, useState } from "react";
import { Button, Grid, InputAdornment, TextField, Typography, withStyles } from "@material-ui/core";
import { Search as SearchIcon } from "@material-ui/icons";
import PropTypes from "prop-types";
import { bigNumberify, toNumber, toString } from "ethers/utils";

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "100%",
    justifyContent: "flex-start",
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
    textAlign: "left",
    fontStyle: "italic",
    fontWeight: "700",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
  },
  cardText: {
    textAlign: "left",
    fontSize: "18px",
    color: "#002868",
    textDecoration: "none",
  },
  channelStateGrid: {},
  icon: {
    color: "#002868",
  },
  xPubEntry: {
    width: "40%",
    margin: "2% 5% 5% 1%",
  },
};

const DebugChannel = props => {
  const { classes, messaging, token } = props;

  // const [messaging, setMessaging] = useState(props.messaging);
  const [xPubSearch, setXPubSearch] = useState("");
  const [noFreeBalance, setNoFreeBalance] = useState(null);
  const [channelState, setChannelState] = useState(null);

  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => {
      const getNoFreeBalance = async () => {
        // var res = await messaging.request(
        //   "admin.get-channel-states",
        //   5000,
        //   {
        //     userPublicIdentifier:
        //       "xpub6DgQCJcuAkGqtpzj3eHC7uLatyyPoNGQVegrRsSWFyHVXCZb4PVo6b8sRCHDJuEMfJsfaoB64AjaouN8mdAWpLEGMffwcZetbDx9M5Z9AKg",
        //   },
        //   {
        //     token: "foo",
        //   },
        // );
        var res = await messaging.request("admin.get-no-free-balance", 5000, {
          token: token,
        });
        setNoFreeBalance(JSON.stringify(res));
      };
      await getNoFreeBalance();
    })();
  });

  const getChannelState = async () => {
    var res = await messaging.request("admin.get-channel-states", 5000, {
      token: token,
      id:xPubSearch
    });

    var extractedValues = Object.values(Object.values(res)[0].response[0].value)[0];
    extractedValues.freeBalanceAppInstance.latestState.balances[0].forEach((balance)=>{
      balance.amount.readable = bigNumberify(balance.amount._hex).toString()
    })
    
    setChannelState(extractedValues);
  };

  return (
    <Grid className={classes.top} container>
      <Grid className={classes.xPubEntry}>
        <TextField
          fullWidth
          id="outlined"
          label="Public Identifier"
          type="string"
          value={xPubSearch}
          onChange={evt => setXPubSearch(evt.target.value)}
          margin="normal"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  variant="contained"
                  onClick={async () => {
                    await getChannelState();
                  }}
                >
                  <SearchIcon />
                </Button>
              </InputAdornment>
            ),
          }}
        />
        {/* <Typography className={classes.cardText}>{noFreeBalance}</Typography> */}
        {!!channelState &&
          Object.entries(channelState).map(([k, v], i) => {
            // if (Object.entries(v).length > 1) {
            //   return(
            //     Object.entries(channelState).map(([k2, v2], i) => {
            //     <Typography className={classes.cardText}>{`${k}: ${}`}</Typography>})
            //   );
            // } else {
            return (
              <Grid className={classes.channelStateGrid}>
                <Typography className={classes.cardTextBold} key={k}>{`${k}: `}</Typography>
                  <pre>{`${JSON.stringify(v, null, 4)}`}</pre>
              </Grid>
            );
            // }
          })}
      </Grid>
    </Grid>
  );
};

DebugChannel.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(DebugChannel);
