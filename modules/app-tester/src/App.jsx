import React from "react";
import { Grid, Paper } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import AppSelector from "./components/AppSelector";

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

export default function App() {
  const classes = useStyles();

  return (
    <Grid container>
      <Grid item xs={12}>
        <Paper className={classes.paper}>
          <Grid container>
            <Grid item xs={6}>
              <AppSelector />
            </Grid>
            <Grid item xs={6} />
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}
