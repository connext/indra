import React from "react";
import { Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";

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
    marginLeft:"2%"
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

function DebugNode(props) {
  const { classes } = props;
  return (
    <Grid className={classes.top} container>
      <Grid className={classes.nodeInfo}>
        <a
          className={classes.cardText}
          href="https://etherscan.io/address/0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39"
        >
          Mainnet
        </a>
        <Typography>
        xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m
      </Typography>
      </Grid>
     
      <Grid className={classes.nodeInfo}>
        <a
          className={classes.cardText}
          href="https://rinkeby.etherscan.io/address/0x0f41a9aaee33d3520f853cb706c24ca75cac874e"
        >
          Staging
        </a>
        <Typography>
        ???
      </Typography>
      </Grid>
      <Grid className={classes.nodeInfo}>
        <a
          className={classes.cardText}
          href="https://rinkeby.etherscan.io/address/0x5307b4f67ca8746562a4a9fdeb0714033008ef4a"
        >
          Rinkeby
        </a>
        <Typography>
          xpub6EUSTe4tBM9vQFvYf3jNHfHAVasAVndhVdn1jFv5vv3dBwjxtiDbQoPZiCUYhNH3EFeiYVeKSckn4YqVqG9NhBe9K8XFF3xa1m9Z3h7kyBW
        </Typography>
      </Grid>
    </Grid>
  );
}

DebugNode.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(DebugNode);
