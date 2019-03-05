import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import { TextField } from "@material-ui/core";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import get from "../get";

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
      console.log(`number: ${this.state.numberOfRecords}`)
    const res = await get(`users/${this.state.addressInput}/${this.state.numberOfRecords}`);
    if (res.length>0) {
      this.setState({ userInfo: res });
    } else {
      this.setState({ userInfo: "Address not found" });
    }
  };

  handleChange = evt => {
    console.log(evt.target.value)
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
            <Button variant="contained" onClick={() => this.searchByAddress(this.addressInput, this.numberOfRecords)}>
              Search
            </Button>
          </div>
          <div>
            {this.state.userInfo ? (
              <Typography variant="body1">{this.state.userInfo}</Typography>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }
}

export const UserInfoStyled = withStyles(styles)(UserInfo);
