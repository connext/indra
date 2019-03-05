import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import get from "../get";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

const styles = theme => ({
  card: {
    minWidth: 275,
    textAlign: "left"
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    height: "100vh",
    overflow: "auto"
  },
  table: {
    maxWidth: "50%"
  }
});

class GasCostCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      gasTotal: null,
      gasLastWeek: null,
      gasLastDay: null
    };
  }

  setGas = async () => {
    const res = await get(`gascost/all`);
    if (res && res.sum) {
      this.setState({ gasTotal: res.sum });
    } else {
      this.setState({ gasTotal: 0 });
    }
  };

  setGasLastWeek = async () => {
    const res = await get(`gascost/trailingweek`);
    if (res && res.sum) {
      this.setState({ gasLastWeek: res.sum });
    } else {
      this.setState({ gasLastWeek: 0 });
    }
  };

  setGasLastDay = async () => {
    const res = await get(`gascost/trailing24`);
    if (res && res.sum) {
      this.setState({ gasLastDay: res.sum });
    } else {
      this.setState({ gasLastDay: 0 });
    }
  };

  componentDidMount = async () => {
    await this.setGas();
    await this.setGasLastDay();
    await this.setGasLastWeek();
  };

  render() {
    const { classes } = this.props;
    return (
      <div className={classes.content}>
        <Card className={classes.card}>
          <CardContent>
            <Table className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <Typography variant="h6"> Gas Paid by Hub</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Past 24 hours</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.gasLastDay}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Past week</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.gasLastWeek}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Total</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.gasTotal}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export const GasCostCardStyled = withStyles(styles)(GasCostCard);
