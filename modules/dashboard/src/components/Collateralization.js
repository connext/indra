import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import get from "../get";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

const styles = theme => ({
  card: {
    minWidth: 275,
    textAlign: "left",
    marginBottom:"3%"
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

class CollateralCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      collateralRatio: null,
      inactiveChannels: null,
      overCollateralized:null,
    };
  }

  getRatio = async () => {
    const { ratio } = await get(`collateralization/ratio`);
    if (ratio) {
      this.setState({ collateralRatio: ratio });
    }
  };

  getInactive = async () => {
    const inactiveChannels = await get(`channels/inactive`);
    if (inactiveChannels) {
      // handle case where hub returns a
      this.setState({ inactiveChannels, });
    }
    console.log(`inactive channels: ${JSON.stringify(this.state.inactiveChannels)}`)
  };

  getOvercollateralized = async () => {
    const overCollateralized = await get(`collateralization/overcollateralized`);
    if (overCollateralized) {
      this.setState({ overCollateralized });
    }
  };

  _handleRefresh = async () => {
    await this.getRatio();
    await this.getInactive();
    await this.getOvercollateralized();
  };

  componentDidMount = async () => {
    await this._handleRefresh()
  };

  render() {
    const { classes } = this.props;
    const { inactiveChannels, overCollateralized, collateralRatio } = this.state;
    return (
      <div className={classes.content}>
        <Card className={classes.card}>
          <CardContent>
            <Table className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <Typography variant="h6">Collateral Summary</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">
                      Collateralization Ratio
                    </Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {collateralRatio}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <Button variant="contained" onClick={() => this._handleRefresh()}>
            Refresh
          </Button>
        </Card>
        <Card className={classes.card}>
            <CardContent>
              <Table className={classes.table}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="h6">Last Update</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="h6">Channels</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="h6">Collateral Locked</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                {inactiveChannels ? (
                <TableBody>
                  {inactiveChannels.map(n => (
                    <TableRow key={n.last_update}>
                      <TableCell component="th" scope="row">
                        {n.last_update}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {n.count}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {n.collateral_locked}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
          ) : (null)}
          </Table>
          </CardContent>
          <Button variant="contained" onClick={() => this._handleRefresh()}>
            Refresh
          </Button>
          </Card>
          <Card className={classes.card}>
            <CardContent>
              <Table className={classes.table}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="h6">User</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="h6">Collateral Locked</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                {overCollateralized ? (
                <TableBody>
                  {overCollateralized.map(n => (
                    <TableRow key={n.user}>
                      <TableCell component="th" scope="row">
                        {n.user}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {n.collateral}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
          ) : (null)}
          </Table>
          </CardContent>
          <Button variant="contained" onClick={() => this._handleRefresh()}>
            Refresh
          </Button>
        </Card>
      </div>
    );
  }
}

export const CollateralCardStyled = withStyles(styles)(CollateralCard);
