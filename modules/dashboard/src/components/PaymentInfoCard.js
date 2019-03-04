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
  }
});

class PaymentInfoCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      totalPayments: null,
      paymentsLastDay: null,
      averagePaymentWei: null,
      averagePaymentToken: null,
      averagePaymentWeiLastDay: null,
      averagePaymentTokenLastDay: null,
      idInput: "",
      paymentInfo: null
    };
  }

  setTotal = async () => {
    const res = await get(`payments/total`);
    if (res) {
      this.setState({ totalPayments: res.count });
    } else {
      this.setState({ totalPayments: 0 });
    }
  };

  setTrailing = async () => {
    const res = await get(`payments/trailing24`);
    if (res) {
      this.setState({ paymentsLastDay: res.count });
    } else {
      this.setState({ paymentsLastDay: "N/A" });
    }
  };

  setAverage = async () => {
    const res = await get(`payments/average/all`);
    if (res && res.avg_wei_payment && res.avg_token_payment) {
      this.setState({
        averagePaymentWei: res.avg_wei_payment,
        averagePaymentToken: res.avg_token_payment
      });
    } else {
      this.setState({
        averagePaymentWei: "N/A",
        averagePaymentToken: "N/A"
      });
    }
  };

  setAverageTrailing = async () => {
    const res = await get(`payments/average/trailing24`);
    if (res && res.avg_wei_payment && res.avg_token_payment) {
      this.setState({
        averagePaymentWeiLastDay: res.avg_wei_payment,
        averagePaymentTokenLastDay: res.avg_token_payment
      });
    } else {
      this.setState({
        averagePaymentWeiLastDay: "N/A",
        averagePaymentTokenLastDay: "N/A"
      });
    }
  };

  searchById = async id => {
    const res = await get(`payments/${id}`);
    if (res) {
      this.setState({ paymentInfo: res });
    } else {
      this.setState({ paymentInfo: "ID not found" });
    }
  };

  handleChange = evt => {
    this.setState({ idInput: evt.target.value });
  };

  componentDidMount = async () => {
    await this.setTrailing();
    await this.setTotal();
    await this.setAverage();
    await this.setAverageTrailing();
  };

  render() {
    const { classes } = this.props;
    return (
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h4">
            Total Payments via Hub: {this.state.totalPayments}
          </Typography>
          <Typography variant="h6">
            Average Token Payment: {this.state.averagePaymentToken}
          </Typography>
          <Typography variant="h6">
            Average Wei Payment: {this.state.averagePaymentWei}
          </Typography>
          <Typography variant="h4">
            Payments in last 24 hrs: {this.state.paymentsLastDay}
          </Typography>
          <Typography variant="h6">
            Average Token Payment: {this.state.averagePaymentTokenLastDay}
          </Typography>
          <Typography variant="h6">
            Average Wei Payment: {this.state.averagePaymentWeiLastDay}
          </Typography>
          <Typography variant="h4">Search by payment ID</Typography>
          <div>
            <TextField
              id="outlined"
              label="Payment ID"
              value={this.state.idInput}
              onChange={evt => this.handleChange(evt)}
              margin="normal"
              variant="outlined"
            />
            <Button variant="contained" onClick={() => this.searchById()}>Search</Button>
          </div>
          <div>
            {this.state.paymentInfo ? (
              <Typography variant="body1">{this.state.paymentInfo}</Typography>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }
}

export const PaymentInfoCardStyled = withStyles(styles)(PaymentInfoCard);
