import { Button, Grid, Tooltip, Typography, withStyles } from "@material-ui/core";
import React from "react";
import PropTypes from 'prop-types';

import { Copyable } from "./copyable";
import { QRGenerate } from "./qrCode";

const styles ={
  top:{
    paddingLeft: "10%",
    paddingRight: "10%",
    paddingTop: "10%",
    paddingBottom: "10%",
    textAlign: "center",
    justifyContent: "center"
  },
  icon: {
    width: "40px",
    height: "40px"
  },
  button:{
    background: "#FFF",
    border: "1px solid #F22424",
    color: "#F22424",
    width: "15%"
  }
};

function DepositCard(props){

  const { classes, address, history, maxDeposit, minDeposit } = props;

  const minEth = minDeposit ? minDeposit.toETH().format() : '?.??'
  const maxEth = maxDeposit ? maxDeposit.toETH().format() : '?.??'
  const maxDai = maxDeposit ? maxDeposit.toDAI().format() : '?.??'

  return (
    <Grid
      container
      spacing={2}
      direction="column"
      className={classes.top}
    >
      <Grid item xs={12} margin="1em">
        <QRGenerate value={address} />
      </Grid>
      <Copyable text={address} />
      <Grid item xs={12}>
        <Typography variant="body2">
          <span> Send funds to this address to deposit. </span>
        </Typography>
        <Typography variant="body2">
          <Tooltip
            disableFocusListener
            disableTouchListener
            title="Because gas"
          >
            <span>{`Deposit minimum of: ${minEth || "?.??"}.`}</span>
          </Tooltip>
        </Typography>
        <Typography variant="body2">
          <span>{`Up to ${maxEth || "?.??"} Eth 
                    or ${maxDai || "?.??"} Dai will be deposited into the state channel, any leftovers will be kept on-chain`}</span>
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          className={classes.button}
          size="medium"
          onClick={() => history.push("/")}
        >
          Back
        </Button>
      </Grid>
    </Grid>
  );
}

DepositCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(DepositCard);
