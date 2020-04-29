import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  styled,
} from "@material-ui/core";
import { Search as SearchIcon } from "@material-ui/icons";
import { BigNumber } from "ethers";
import JSONTree from "react-json-tree";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

const ErrorTypography = styled(Typography)({
  color: "red",
});

const CardTextTypography = styled(Typography)({
  fontStyle: "italic",
  fontWeight: "700",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
});

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
      res.freeBalanceAppInstance.latestState.balances[0].forEach((balance) => {
        balance.amount.readable = BigNumber.from(balance.amount._hex).toString();
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
      res.freeBalanceAppInstance.latestState.balances[0].forEach((balance) => {
        balance.amount.readable = BigNumber.from(balance.amount._hex).toString();
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
    <RootGrid container spacing={3}>
      <Grid item xs={12}>
        <ErrorTypography>{searchError}</ErrorTypography>
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          id="outlined"
          label="Public Identifier"
          type="string"
          value={xPubSearch}
          onChange={(evt) => setXPubSearch(evt.target.value)}
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
                  {loading ? <CircularProgress color="primary" /> : <SearchIcon />}
                </Button>
              </InputAdornment>
            ),
          }}
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          id="outlined"
          label="Multisig Address"
          type="string"
          value={multiSigSearch}
          onChange={(evt) => setMultiSigSearch(evt.target.value)}
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
                  {loading ? <CircularProgress color="primary" /> : <SearchIcon />}
                </Button>
              </InputAdornment>
            ),
          }}
        />
      </Grid>
      <Grid item xs={12}>
        <CardTextTypography>Free Balance: {freeBalance}</CardTextTypography>
      </Grid>
      {
        !!channelState && <JSONTree data={channelState} />
        // Object.entries(channelState).map(([k, v], i) => {
        //   // if (Object.entries(v).length > 1) {
        //   //   return(
        //   //     Object.entries(channelState).map(([k2, v2], i) => {
        //   //     <Typography className={classes.cardText}>{`${k}: ${}`}</Typography>})
        //   //   );
        //   // } else {
        //   return (
        //     <Grid item xs={12}>
        //       <CardTextTypography key={k}>{`${k}: `}</CardTextTypography>
        //       <pre>{`${JSON.stringify(v, null, 4)}`}</pre>
        //     </Grid>
        //   );
        //   // }
        // })
      }
    </RootGrid>
  );
};

export default DebugChannel;
