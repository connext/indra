import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import { TextField } from "@material-ui/core";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import axios from "axios";

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
  }
});

class UserInfo extends Component {
  constructor(props) {
    super(props);
    this.state = {
      addressInput: "",
      userInfo: null,
      numberOfRecords: 10
    };
  }

  searchByAddress = async () => {
    console.log(`address: ${this.state.addressInput}`);
    console.log(`number: ${this.state.numberOfRecords}`);
    const url = `${this.props.urls.api}/users/${this.state.addressInput}/${this.state.numberOfRecords}`
    const res = (await axios.get(url)).data || null
    if (res.length > 0) {
      this.setState({ userInfo: res });
    } else {
      this.setState({ userInfo: "Address not found" });
    }
  };

  handleChange = evt => {
    console.log(evt.target.value);
    this.setState({ addressInput: evt.target.value });
  };

  handleNumberChange = evt => {
    this.setState({ numberOfRecords: evt.target.value });
  };

  render() {
    const { classes } = this.props;
    return (
      <div className={classes.content}>
        <Card className={classes.card}>
          <CardContent>
            <Typography variant="h4">Users</Typography>
            <div>
              <TextField
                id="outlined"
                label="Address"
                value={this.state.addressInput}
                onChange={evt => this.handleChange(evt)}
                margin="normal"
                variant="outlined"
              />
              <TextField
                id="outlined-number"
                label="Number of Records"
                value={this.state.numberOfRecords}
                onChange={evt => this.handleNumberChange(evt)}
                margin="normal"
                variant="outlined"
              />
              <Button
                variant="contained"
                onClick={async () =>
                  await this.searchByAddress(
                    this.addressInput,
                    this.numberOfRecords
                  )
                }
              >
                Search
              </Button>
            </div>
            <div style={{
                overflowX: "scroll",
              }}>
              {this.state.userInfo ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Reason</TableCell>
                      <TableCell>Created On</TableCell>
                      <TableCell>User Wei</TableCell>
                      <TableCell>User Tokens</TableCell>
                      <TableCell>Hub Wei</TableCell>
                      <TableCell>Hub Tokens</TableCell>
                      <TableCell>User Pending Deposit Wei</TableCell>
                      <TableCell>User Pending Deposit Token</TableCell>
                      <TableCell>Hub Pending Deposit Wei</TableCell>
                      <TableCell>Hub Pending Deposit Token</TableCell>
                      <TableCell>User Pending Withdrawal Wei</TableCell>
                      <TableCell>User Pending Withdrawal Token</TableCell>
                      <TableCell>Hub Pending Withdrawal Wei</TableCell>
                      <TableCell>Hub Pending Withdrawal Token</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {this.state.userInfo.map((n, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {n.reason}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.created_on}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.balance_wei_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.balance_token_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.balance_wei_hub}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.balance_token_hub}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_deposit_wei_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_deposit_token_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_deposit_wei_hub}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_deposit_token_hub}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_withdrawal_wei_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_withdrawal_token_user}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_withdrawal_wei_hub}
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {n.pending_withdrawal_token_hub}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export const UserInfoStyled = withStyles(styles)(UserInfo);
