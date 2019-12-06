import React, { useEffect, useState } from "react";
import { Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";
const axios = require("axios");

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    marginTop: "2%",
    marginLeft: "2%",
  },
  nodeInfo: {
    justifyContent: "flex-start",
    marginVertical: "5%",
    flexDirection: "row",
  },
  cardText: {
    textAlign: "left",
    fontSize: "24px",
    color: "#002868",
  },
};

const address = {
  mainnet: "0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39",
  staging: "0x0f41a9aaee33d3520f853cb706c24ca75cac874e",
  rinkeby: "0x5307b4f67ca8746562a4a9fdeb0714033008ef4a",
};

function DebugNode(props) {
  const { classes } = props;
  const [ethBalances, setEthBalances] = useState(null);
  const [daiBalances, setDaiBalances] = useState(null);

  useEffect(() => {
    getBalances(Object.values(address));    
  }, []);

  async function getBalances(addressArr) {
    const balances = await Promise.all(
      addressArr.map(
        async address =>
          await axios.get("http://api.ethplorer.io/getAddressInfo/" + address + "?apiKey=freekey"),
      ),
    );

    var eth = {
      mainnet: balances[0].data.ETH.balance,
      staging: balances[1].data.ETH.balance,
      rinkeby: balances[2].data.ETH.balance,
    };
    var dai = {
      mainnet: balances[0].data.tokens ? balances[0].data.tokens[0].balance / 1000000000000000000 : 0,
      staging: balances[1].data.tokens ? balances[1].data.tokens[0].balance / 1000000000000000000 : 0,
      rinkeby: balances[2].data.tokens ? balances[2].data.tokens[0].balance / 1000000000000000000 : 0,
    };

    console.log(dai)
    setEthBalances(eth);
    setDaiBalances(dai);

    return eth, dai;
  }

  return (
    <Grid className={classes.top} container>
      <Grid className={classes.nodeInfo}>
        <a className={classes.cardText} href={`https://etherscan.io/address/${address.mainnet}`}>
          Mainnet
        </a>
        <Typography>Eth Balance: {ethBalances? ethBalances.mainnet: "loading..."}</Typography>
        <Typography>Dai Balance: {daiBalances? daiBalances.mainnet: "loading..."}</Typography>
        <Typography>
          Public Identifier: xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m
        </Typography>
      </Grid>

      <Grid className={classes.nodeInfo}>
        <a className={classes.cardText} href={`https://etherscan.io/address/${address.staging}`}>
          Staging
        </a>
        <Typography>Eth Balance: {ethBalances? ethBalances.staging: "loading..."}</Typography>
        <Typography>Dai Balance: {daiBalances? daiBalances.staging: "loading..."}</Typography>
        <Typography>Public Identifier: ???</Typography>
      </Grid>
      <Grid className={classes.nodeInfo}>
        <a className={classes.cardText} href={`https://etherscan.io/address/${address.rinkeby}`}>
          Rinkeby
        </a>
        <Typography>Eth Balance: {ethBalances? ethBalances.rinkeby: "loading..."}</Typography>
        <Typography>Dai Balance: {daiBalances? daiBalances.rinkeby: "loading..."}</Typography>
        <Typography>
          Public Identifier: xpub6EUSTe4tBM9vQFvYf3jNHfHAVasAVndhVdn1jFv5vv3dBwjxtiDbQoPZiCUYhNH3EFeiYVeKSckn4YqVqG9NhBe9K8XFF3xa1m9Z3h7kyBW
        </Typography>
      </Grid>
    </Grid>
  );
}

DebugNode.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(DebugNode);
