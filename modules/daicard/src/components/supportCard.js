import { Button, Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";

import React, { useEffect, useState } from "react";

const styles = {
  icon: {
    width: "40px",
    height: "40px",
  },
};

const SupportCard = props => {
  return (
    <Grid
      container
      spacing={8}
      direction="column"
      style={{
        paddingLeft: "5%",
        paddingRight: "5%",
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <Grid item xs={12}>
        <Typography variant="h3">
          <span>{`Uh oh!`}</span>
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography paragraph variant="h6">
          <span>{`There seems to be an error with your channel. Contact us on discord to resolve this gaslessly!`}</span>
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            width: "15%",
          }}
          size="medium"
          onClick={() => {
            window.open("https://discord.gg/q2cakRc", "_blank");
            window.close();
            return false;
          }}
        >
          Support
        </Button>
      </Grid>
    </Grid>
  );
};

SupportCard.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SupportCard);
