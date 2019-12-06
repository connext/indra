import React from "react";
import { Card, Grid, Typography, withStyles } from "@material-ui/core";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height:"100%",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginTop:"15%",
      display:"flex",
      height:"320px",
      width:"320px",
      alignItems:"center",
      justifyContent:"center",
      margin:"0% 2% 0% 2%",
      border: "3px solid #002868",
      textDecoration:"none",
      '&:hover': {backgroundColor:"rgba(0,40,104,0.2)"}
  },
  cardText:{
      textAlign:"center",
      fontSize:"24px",
      color:"#002868",
      textDecoration:"none"
  }
};

function Home(props) {
    const {classes, prefix} = props; 
  return (
    <Grid className={classes.top} container>
      <Card className={classes.card} component={Link} to={`${prefix}/debug`}>
        <Typography className={classes.cardText}>Debug</Typography>
      </Card>
      <Card className={classes.card} component={Link} to={`${prefix}/stats`}>
        <Typography className={classes.cardText}>Node Stats</Typography>
      </Card>
    </Grid>
  );
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(Home);
