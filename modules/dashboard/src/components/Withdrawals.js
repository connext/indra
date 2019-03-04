import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import get from "../get";

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
    const res = await get(`withdrawals/average`);
    if (res && res.avg_withdrawal_wei && res.avg_withdrawal_token) {
      this.setState({
        withdrawalAverageToken: res.avg_withdrawal_token,
        withdrawalAverageWei: res.avg_withdrawal_wei
      });
    } else {
      this.setState({
        withdrawalAverageToken: "N/A",
        withdrawalAverageWei: "N/A"
      });
    }
  };

  setTotal = async () => {
    const res = await get(`withdrawals/total`);
    if (res && res.count) {
      this.setState({ withdrawalTotal: res.count });
    } else {
      this.setState({ gasLastWeek: "N/A" });
    }
  };

  setFrequency = async () => {
    const res = await get(`withdrawals/frequency`);
    if (res) {
      this.setState({ withdrawalBreakdown: JSON.stringify(res) });
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
