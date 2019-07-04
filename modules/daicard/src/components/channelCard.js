import { Grid, Typography, withStyles } from "@material-ui/core";
import { ethers as eth } from "ethers";
import React from "react";

const styles = theme => ({
  row: {
    color: "white"
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
  const { balance, classes } = props;
  const split = (balance) => {
    const bal = balance.format({ decimals: 2, symbol: false });
    const whole = bal.substring(0, bal.indexOf('.'));
    const part = bal.substring(bal.indexOf('.'));
    return { whole, part: part.length === 2 ? `${part}0` : part.substring(0,3) };
  }
  return (
      <Grid>
        <Grid 
          container
          spacing={2}
          direction="column"
          style={{
            paddingLeft: "10%",
            paddingRight: "10%",
            paddingTop: "10%",
            paddingBottom: "20%",
            backgroundColor: "#282b2e",
            textAlign: "center"
          }}
          alignItems="center"
          justify="center"
        >

        <Grid item xs={12}>
          <Typography style={{ color: 'white' }}> Channel </Typography>
          <span>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              {"$ "}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h1" className={classes.row}>
              <span>{split(balance.channel.token.toDAI()).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.channel.token.toDAI()).part}</span>
            </Typography>
          </span>
          <span style={{fontSize: 64}}>&nbsp;&nbsp;&nbsp;</span>
          <span>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              {`${eth.constants.EtherSymbol} `}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h1" className={classes.row}>
              <span>{split(balance.channel.ether.toETH()).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.channel.ether.toETH()).part}</span>
            </Typography>
          </span>
        </Grid>

        <br/>

        <Grid item xs={12}>
          <Typography style={{ color: 'white' }}> On-Chain </Typography>
          <span>
            <Typography style={{display: 'inline-block'}} variant="h5" className={classes.row}>
              {"$ "}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.onChain.token.toDAI()).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h5" className={classes.row}>
              <span>{split(balance.onChain.token.toDAI()).part}</span>
            </Typography>
          </span>
          <span style={{fontSize: 64}}>&nbsp;&nbsp;&nbsp;</span>
          <span>
            <Typography style={{display: 'inline-block'}} variant="h5" className={classes.row}>
              {`${eth.constants.EtherSymbol} `}
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h3" className={classes.row}>
              <span>{split(balance.onChain.ether.toETH()).whole}</span>
            </Typography>
            <Typography style={{display: 'inline-block'}} variant="h5" className={classes.row}>
              <span>{split(balance.onChain.ether.toETH()).part}</span>
            </Typography>
          </span>
        </Grid>

      </Grid>
    </Grid>
  );
});
