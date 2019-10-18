import { Grid, Typography, withStyles } from "@material-ui/core";
import React from "react";

// import { ethers as eth } from "ethers";

const styles = theme => ({
  row: {
    color: "#002868"
  },
  pending: {
    marginBottom: "3%",
    color: "white"
  },
  clipboard: {
    cursor: "pointer"
  }
});

export const ChannelCard = withStyles(styles)(props => {
  const { balance, classes, swapRate } = props;
  const split = (balance) => {
    const bal = balance.format({ decimals: 2, symbol: false, round: false });
    const whole = bal.substring(0, bal.indexOf('.'));
    const part = bal.substring(bal.indexOf('.'));
    return { whole, part: part.substring(0,4) };
  }
  return (
        <Grid item xs={12}>
          {/* <Typography style={{ color: 'white' }}> Channel </Typography> */}
          <span id="balance-channel-token">
            <Typography style={{display: 'inline-block'}} variant="h4" className={classes.row}>
              {"$ "}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.channel.token.toDAI(swapRate)).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h4" className={classes.row}>
              <span>{split(balance.channel.token.toDAI(swapRate)).part}</span>
            </Typography>
          </span>
          {/* <span style={{fontSize: 64}}>&nbsp;&nbsp;&nbsp;</span> */}
          {/* <span id="balance-channel-ether">
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              {`${eth.constants.EtherSymbol} `}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h1" className={classes.row}>
              <span>{split(balance.channel.ether.toETH()).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.channel.ether.toETH()).part}</span>
            </Typography>
          </span> */}
        </Grid>
  );
});
