import React, { useEffect, useState } from "react";
import { Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";

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
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
  },
};

function StatsTransfers({ classes, messaging }) {
  const [allTransfers, setAllTransfers] = useState(null);

  useEffect(() => {
    getTransfers();
  }, []);

  const getTransfers = async () => {
    async function requestTransfers() {
      const res = await messaging.getAllTransfers();
      setAllTransfers(res);
    }

    // @hunter -- there has to be a better way to do this instead
    // of the setTimeout and while loop method
    while (!messaging || !messaging.connected) {
      setTimeout(requestTransfers, 200);
    }
  };

  return (
    <Grid className={classes.top} container>
      <Typography className={classes.cardText}>Hello</Typography>
      <Typography className={classes.cardText}>World</Typography>
    </Grid>
  );
}

StatsTransfers.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(StatsTransfers);
