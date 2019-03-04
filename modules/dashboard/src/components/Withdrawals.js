import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import axios from "axios";

const styles = theme => ({
  card: {
    minWidth: 275,
    textAlign: "left"
  }
});

class Withdrawals extends Component {
  constructor(props) {
    super(props);
    this.state = {
      withdrawalAverageWei: null,
      withdrawalAverageToken: null,
      withdrawalTotal: null,
      withdrawalBreakdown: null
    };
  }

  setAverage = async () => {
    const res = await axios.get(`${this.props.apiUrl}/withdrawals/average`);
    console.log(res);
    if (res.data[0].avg_withdrawal_wei || res.data[0].avg_withdrawal_token) {
      this.setState({
        withdrawalAverageToken: res.data[0].avg_withdrawal_token,
        withdrawalAverageWei: res.data[0].avg_withdrawal_wei
      });
    } else {
      this.setState({
        withdrawalAverageToken: "N/A",
        withdrawalAverageWei: "N/A"
      });
    }
  };

  setTotal = async () => {
    const res = await axios.get(`${this.props.apiUrl}/withdrawals/total`);
    console.log(res);
    if (res.data[0].count) {
      this.setState({ withdrawalTotal: res.data[0].count });
    } else {
      this.setState({ gasLastWeek: "N/A" });
    }
  };

  setFrequency = async () => {
    const res = await axios.get(`${this.props.apiUrl}/withdrawals/frequency`);
    console.log(res);
    if (res.data.length > 0) {
      this.setState({ withdrawalBreakdown: JSON.stringify(res.data[0]) });
    } else {
      this.setState({ withdrawalBreakdown: "N/A" });
    }
  };

  componentDidMount = async () => {
    await this.setTotal();
    await this.setAverage();
    await this.setFrequency();
  };

  render() {
    const { classes } = this.props;
    return (
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h4">Withdrawals</Typography>
          <Typography variant="h6">
            Total Count: {this.state.withdrawalTotal}
          </Typography>
          <Typography variant="h6">
            Average Token: {this.state.withdrawalAverageToken}
          </Typography>
          <Typography variant="h6">
            Average Wei: {this.state.withdrawalAverageWei}
          </Typography>

           <Typography variant="h6">
          Breakdown of last week:  {this.state.withdrawalBreakdown}
          </Typography> 
        </CardContent>
      </Card>
    );
  }
}

export const WithdrawalsStyled = withStyles(styles)(Withdrawals);
