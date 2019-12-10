import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Search as SearchIcon } from "@material-ui/icons";
import PropTypes from "prop-types";
import { bigNumberify } from "ethers/utils";

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
  channelStateGrid: {},
  icon: {
    color: "#002868",
  },
  xPubEntry: {
    width: "40%",
    margin: "2% 5% 5% 1%",
  },
  error: {
    color: "red",
  },
  errorWrap: {
    width: "100%",
  },
};

const DebugChannel = ({ classes, messaging }) => {
  // const [messaging, setMessaging] = useState(props.messaging);
  const [xPubSearch, setXPubSearch] = useState("");
  const [multiSigSearch, setMultiSigSearch] = useState("");
  const [, setNoFreeBalance] = useState(null);
  const [channelState, setChannelState] = useState(null);
  const [freeBalance, setFreeBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (!messaging || !messaging.connected) {
      return;
    }
    (async () => {
      const res = await messaging.getChannelStatesWithNoFreeBalanceApp();
      setNoFreeBalance(JSON.stringify(res));
    })();
  });

  const getChannelState = async () => {
    setLoading(true);
    try {
      const res = await messaging.getStateChannelByUserPubId(xPubSearch);

      let freeBalanceTotalHolder = [];
      res.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
        balance.amount.readable = bigNumberify(balance.amount._hex).toString();
        freeBalanceTotalHolder.push(balance.amount.readable);
      });

      const freeBalanceTotalReduced = freeBalanceTotalHolder.reduce((a, b) => {
        return a + b;
      }, 0);

      setFreeBalance(freeBalanceTotalReduced);
      setChannelState(res);
      setLoading(false);
      setSearchError(null);
    } catch {
      setLoading(false);
      setSearchError(`xPub (${xPubSearch}) not found`);
    }
  };
  const getStateChannelByMultisig = async () => {
    setLoading(true);
    try {
      const res = await messaging.getStateChannelByMultisig(multiSigSearch);

      let freeBalanceTotalHolder = [];
      res.freeBalanceAppInstance.latestState.balances[0].forEach(balance => {
        balance.amount.readable = bigNumberify(balance.amount._hex).toString();
        freeBalanceTotalHolder.push(balance.amount.readable);
      });

      const freeBalanceTotalReduced = freeBalanceTotalHolder.reduce((a, b) => {
        return a + b;
      }, 0);

      setFreeBalance(freeBalanceTotalReduced);
      setChannelState(res);
      setLoading(false);
      setSearchError(null);
    } catch {
      setLoading(false);
      setSearchError(`Multisig (${multiSigSearch}) not found`);
    }
  };

  return (
    <Grid className={classes.top} container>
      <Grid className={classes.errorWrap}>
        <Typography className={classes.error}>{searchError}</Typography>
      </Grid>
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
                  {loading ? <CircularProgress color="blue" /> : <SearchIcon />}
                </Button>
              </InputAdornment>
            ),
          }}
        />

        <Grid className={classes.channelStateGrid}>
          <Typography className={classes.cardTextBold}>Free Balance: {freeBalance}</Typography>
        </Grid>
        {!!channelState &&
          Object.entries(channelState).map(([k, v], i) => {
            // if (Object.entries(v).length > 1) {
            //   return(
            //     Object.entries(channelState).map(([k2, v2], i) => {
            //     <Typography className={classes.cardText}>{`${k}: ${}`}</Typography>})
            //   );
            // } else {
            return (
              <Grid>
                <Typography className={classes.cardTextBold} key={k}>{`${k}: `}</Typography>
                <pre>{`${JSON.stringify(v, null, 4)}`}</pre>
              </Grid>
            );
            // }
          })}
      </Grid>
      <Grid className={classes.xPubEntry}>
        <TextField
          fullWidth
          id="outlined"
          label="Multisig Address"
          type="string"
          value={multiSigSearch}
          onChange={evt => setMultiSigSearch(evt.target.value)}
          margin="normal"
          variant="outlined"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  variant="contained"
                  onClick={async () => {
                    await getStateChannelByMultisig();
                  }}
                >
                  {loading ? <CircularProgress color="blue" /> : <SearchIcon />}
                </Button>
              </InputAdornment>
            ),
          }}
        />
    </Grid>
    </Grid>
  );
};

DebugChannel.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(DebugChannel);
