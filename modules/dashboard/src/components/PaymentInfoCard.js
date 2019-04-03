import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import { TextField } from "@material-ui/core";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Switch from "@material-ui/core/Switch";
import { VictoryChart, VictoryLine, VictoryLabel, VictoryAxis } from "victory";
import DatePicker from "react-datepicker";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";

const styles = theme => ({
  card: {
    minWidth: "40%",
    marginBottom: "3%"
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    height: "100vh",
    overflow: "auto"
  }
});

class PaymentInfoCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      totalPayments: null,
      paymentsLastDay: null,
      averagePaymentWei: {
        raw: null,
        formatted: null
      },
      averagePaymentToken: {
        raw: null,
        formatted: null
      },
      averagePaymentWeiLastDay: {
        raw: null,
        formatted: null
      },
      averagePaymentTokenLastDay: {
        raw: null,
        formatted: null
      },
      idInput: "",
      paymentInfo: null,
      freqArray: null,
      paymentsLastWeek: null,
      paymentsLastWeekPct: null,
      paymentsLastDayPct: null,
      averagePaymentWeiLastWeek: {
        raw: null,
        formatted: null
      },
      averagePaymentTokenLastWeek: {
        raw: null,
        formatted: null
      },
      paymentCountRange:null,
      averagePaymentTokenRange: {
        raw: null,
        formatted: null
      },
      view: false,
      checked: false,
      startDate: new Date(),
      endDate: new Date(),
    };
  }


/*********************
 * Handlers and Hooks
 */

  handleChange = evt => {
    this.setState({ idInput: evt.target.value });
  };

  handleStartChange = (date) => {
    this.setState({
      startDate: date
    })
  }

  handleEndChange = (date) => {
    this.setState({
      endDate: date
    })
  }

  _handleRefresh = async () => {
    await this.setTrailing();
    await this.setTotal();
    await this.setAverage();
    await this.setAverageTrailing();
    await this.setTrailingWeek();
    await this.setTrailingWeekPct();
    await this.setTrailingPct();
    await this.setAverageTrailingWeek();
    //await this.setFrequency();
  };

  componentDidMount = async () => {
    await this._handleRefresh()
  };

  /**************************
   * Payment trends
   */

  setTotal = async () => {
    const url = `${this.props.urls.api}/payments/total`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({ totalPayments: res.count });
    } else {
      this.setState({ totalPayments: 0 });
    }
  };

  //Trailing Day

  setTrailing = async () => {
    const url = `${this.props.urls.api}/payments/trailing24`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({ paymentsLastDay: res.count });
    } else {
      this.setState({ paymentsLastDay: "N/A" });
    }
  };

  setTrailingPct = async () => {
    const url = `${this.props.urls.api}/payments/trailing24/pctchange`
    const res = (await axios.get(url)).data || null
    if (res) {
      console.log(`trailing day pct res ${JSON.stringify(res)}`)

      this.setState({ paymentsLastDayPct: res["pctchange"] });
    } else {
      this.setState({ paymentsLastDayPct: "N/A" });
    }
  };

  //Trailing Week

  setTrailingWeek = async () => {
    const url = `${this.props.urls.api}/payments/trailingweek`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({ paymentsLastWeek: res.count });
    } else {
      this.setState({ paymentsLastWeek: "N/A" });
    }
  };

  setTrailingWeekPct = async () => {
    const url = `${this.props.urls.api}/payments/trailingweek/pctchange`
    const res = (await axios.get(url)).data || null
    if (res) {
      console.log(`trailing week pct res ${JSON.stringify(res)}`)
      this.setState({ paymentsLastWeekPct: res["pctchange"] });
    } else {
      this.setState({ paymentsLastWeekPct: "N/A" });
    }
  };

  /********************
   * Average Payments
   */

  setAverage = async () => {
    const { web3 } = this.props;
    const url = `${this.props.urls.api}/payments/average/all`
    const res = (await axios.get(url)).data || null
    if (res && res.avg_wei_payment && res.avg_token_payment) {
      let tokenDeposit = String(Math.trunc(res.avg_token_payment));
      let weiDeposit = String(Math.trunc(res.avg_wei_payment));
      this.setState(state => {
        state.averagePaymentWei.raw = res.avg_wei_payment;
        state.averagePaymentToken.raw = res.avg_token_payment;
        state.averagePaymentWei.formatted = web3.utils.fromWei(weiDeposit);
        state.averagePaymentToken.formatted = web3.utils.fromWei(tokenDeposit);
        return state;
      });
    } else {
      this.setState(state => {
        state.averagePaymentWei.formatted = "N/A";
        state.averagePaymentToken.formatted = "N/A";
        return state;
      });
    }
  };

  setAverageTrailing = async () => {
    const { web3 } = this.props;
    const url = `${this.props.urls.api}/payments/average/trailing24`
    const res = (await axios.get(url)).data || null
    if (res && res.avg_wei_payment && res.avg_token_payment) {
      let tokenPayment = String(Math.trunc(res.avg_token_payment));
      let weiPayment = String(Math.trunc(res.avg_wei_payment));
      this.setState(state => {
        state.averagePaymentWeiLastDay.raw = res.avg_wei_payment;
        state.averagePaymentTokenLastDay.raw = res.avg_token_payment;
        state.averagePaymentWeiLastDay.formatted = web3.utils.fromWei(
          weiPayment
        );
        state.averagePaymentTokenLastDay.formatted = web3.utils.fromWei(
          tokenPayment
        );
        return state;
      });
    } else {
      this.setState(state => {
        state.averagePaymentWeiLastDay.formatted = "N/A";
        state.averagePaymentTokenLastDay.formatted = "N/A";
        return state;
      });
    }
  };

  setAverageTrailingWeek = async () => {
    const { web3 } = this.props;
    const url = `${this.props.urls.api}/payments/average/trailingweek`
    const res = (await axios.get(url)).data || null
    if (res && res.avg_wei_payment && res.avg_token_payment) {
      let tokenPayment = String(Math.trunc(res.avg_token_payment));
      let weiPayment = String(Math.trunc(res.avg_wei_payment));
      this.setState(state => {
        state.averagePaymentWeiLastWeek.raw = res.avg_wei_payment;
        state.averagePaymentTokenLastWeek.raw = res.avg_token_payment;
        state.averagePaymentWeiLastWeek.formatted = web3.utils.fromWei(
          weiPayment
        );
        state.averagePaymentTokenLastWeek.formatted = web3.utils.fromWei(
          tokenPayment
        );
        return state;
      });
    } else {
      this.setState(state => {
        state.averagePaymentWeiLastWeek.formatted = "N/A";
        state.averagePaymentTokenLastWeek.formatted = "N/A";
        return state;
      });
    }
  };

  /********************
   * Search by ID
   */

  searchById = async id => {
    const url = `${this.props.urls.api}/payments/${id}`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({ paymentInfo: res });
    } else {
      this.setState({ paymentInfo: "Purchase not found" });
    }
  };

   /********************
   * Get values for date range
   */
  fetchDateRange = async() => {

    let start = this.state.startDate.toISOString().split('T')[0];
    let end = this.state.endDate.toISOString().split('T')[0];

    console.log(`Fetching date range: ${start} - ${end}`)
    const { web3 } = this.props;
    const url = `${this.props.urls.api}/payments/daterange/${start}/${end}`
    const res = (await axios.get(url)).data || null
    if (res) {
      let tokenPayment = String(Math.trunc(res.avg_token_payment));
      let count = res.count
      //let weiPayment = String(Math.trunc(res.avg_wei_payment));
      this.setState(state => {
        state.averagePaymentTokenRange.raw = res.avg_token_payment;
        state.averagePaymentTokenRange.formatted = web3.utils.fromWei(
          tokenPayment
        );
        state.paymentCountRange= count;
        return state;
      });
      console.log(this.state.paymentCountRange);
    } else {
      this.setState(state => {
        state.averagePaymentTokenRange.formatted = "N/A";
        state.paymentCountRange = "N/A";
        return state;
      });
    }
  }


  /********************
   * Chart of past week (commented out)
   */

  setFrequency = async () => {
    const url = `${this.props.urls.api}/payments/frequency`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({ freqArray: res });
    }
  };

  setChart = () => {
    if (this.state.freqArray) {
      // TESTING DATA
      // let data = [
      //   {day:"1", count:10},
      //   {day:"2", count:14},
      //   {day:"3", count:8}
      // ]

      const toRender = (
        <VictoryChart
          width={140}
          height={140}
          style={{
            labels: {
              fontSize: 4
            }
          }}
        >
          <VictoryLabel
            x={50}
            y={40}
            text="Payments this Week"
            style={{ fontSize: 4 }}
          />
          <VictoryLine
            x="day"
            y="count"
            standalone={false}
            style={{ data: { strokeWidth: 0.1 } }}
            data={this.state.freqArray}
          />
          <VictoryAxis
            domain={{ y: [0, 100] }}
            dependentAxis={true}
            label="Withdrawals"
            style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
          />
          <VictoryAxis
            dependentAxis={false}
            domain={{ x: [0, 7] }}
            tickValues={[0, 1, 2, 3, 4, 5, 6, 7]}
            label="Day"
            style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
          />
        </VictoryChart>
      );
      console.log(toRender);
      return toRender;
      //this.setState({ withdrawalBreakdown: JSON.stringify(res) });
    }
  };


  render() {
    const { classes } = this.props;
    const PaymentFrequency = this.setChart();

    return (
      <div className={classes.content}>
        <Card className={classes.card}>
          <CardContent>
            <Typography variant="h5" style={{ marginBotton: "5%" }}>
              Payment Summary Statistics
            </Typography>
            <Table className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <Typography variant="h6"> Value </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Count</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.totalPayments}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Average Token Payment</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.averagePaymentToken.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Average ETH Payment</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {this.state.averagePaymentWei.formatted}
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
          <div>
            Past Week
            <Switch
              checked={this.state.checked}
              onChange={() =>
                this.setState(prevState => ({
                  view: !prevState.view,
                  checked: !prevState.checked
                }))
              }
              value="checkedB"
              color="primary"
            />
            Past Day
          </div>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="h6">Count</Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.view
                    ? this.state.paymentsLastDay
                    : this.state.paymentsLastWeek}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                    Average Token Payment
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.view
                    ? this.state.averagePaymentTokenLastDay.formatted
                    : this.state.averagePaymentTokenLastWeek.formatted}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="h6">% Change from Previous</Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.view
                    ? this.state.paymentsLastDayPct
                    : this.state.paymentsLastWeekPct}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Button variant="contained" onClick={() => this._handleRefresh()}>
            Refresh
          </Button>
        </Card>
        <Card className={classes.card}>
        <div>
          Start Date:
            <DatePicker
              selected={this.state.startDate}
              onSelect={(evt) => this.handleStartChange(evt)} //when day is clicked
              onChange={(evt) => this.handleStartChange(evt)} //only when value has changed
            />
          End Date:
            <DatePicker
              selected={this.state.endDate}
              onSelect={(evt) => this.handleEndChange(evt)} //when day is clicked
              onChange={(evt) => this.handleEndChange(evt)} //only when value has changed
            />
          <Button variant="contained" onClick={() =>this.fetchDateRange()}>Submit</Button>
        </div>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="h6">Count</Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.paymentCountRange}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                    Average Token Payment
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.averagePaymentTokenRange.formatted}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <Card className={classes.card}>
          <CardContent>
            <Typography variant="h5" style={{ marginBotton: "5%" }}>
              Payment Search
            </Typography>
            <div>
              <TextField
                id="outlined"
                label="Purchase ID"
                value={this.state.idInput}
                onChange={evt => this.handleChange(evt)}
                margin="normal"
                variant="outlined"
              />
              <Button
                variant="contained"
                onClick={() => this.searchById(this.state.idInput)}
              >
                Search
              </Button>
            </div>
            <div>
              {this.state.paymentInfo ? (
                <Typography component="div" variant="body1">
                  {Object.entries(this.state.paymentInfo).map(([k,v], i) => {
                    return (<div key={k}>
                      {k + ': ' + JSON.stringify(v, null, 2)}
                    </div>)
                  })}
                </Typography>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card className={classes.card}>
          <div style={{ marginTop: "-20%" }}>{PaymentFrequency}</div>
        </Card>
      </div>
    );
  }
}

export const PaymentInfoCardStyled = withStyles(styles)(PaymentInfoCard);
