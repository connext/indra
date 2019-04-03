import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { withStyles } from "@material-ui/core/styles";
import { VictoryChart, VictoryBar, VictoryLabel, VictoryAxis } from "victory";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import axios from "axios";

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
    maxWidth:"50%"
  }
});

class Withdrawals extends Component {
  constructor(props) {
    super(props);
    this.state = {
      withdrawalAverageWei: {
        raw:null,
        formatted:null
      },
      withdrawalAverageToken: {
        raw:null,
        formatted:null
      },
      withdrawalTotal: null,
      freqArray:[],
      WithdrawalFrequency:null
    };
  }

  setAverage = async () => {
    const {web3} = this.props;
    const url = `${this.props.urls.api}/withdrawals/average`
    const res = (await axios.get(url)).data || null
    if (res && res.avg_withdrawal_wei && res.avg_withdrawal_token) {
      let tokenWithdrawal = String(Math.trunc(res.avg_withdrawal_token))
      let weiWithdrawal = String(Math.trunc(res.avg_withdrawal_wei))

      this.setState(state => {
        state.withdrawalAverageToken.raw = res.avg_withdrawal_token
        state.withdrawalAverageToken.formatted = web3.utils.fromWei(tokenWithdrawal);
        state.withdrawalAverageWei.raw = res.avg_withdrawal_wei
        state.withdrawalAverageWei.formatted = web3.utils.fromWei(weiWithdrawal);
        return state
      });
    } else {
      this.setState(state => {
        state.withdrawalAverageToken.formatted= "N/A"
        state.withdrawalAverageWei.formatted= "N/A"
        return state
      });
    }
  };

  setTotal = async () => {
    const url = `${this.props.urls.api}/withdrawals/total`
    const res = (await axios.get(url)).data || null
    if (res && res.count) {
      this.setState({ withdrawalTotal: res.count });
    } else {
      this.setState({ withdrawalTotal: "N/A" });
    }
  };

  setFrequency = async() =>{
    const url = `${this.props.urls.api}/withdrawals/frequency`
    const res = (await axios.get(url)).data || null
    if (res){
      this.setState({ freqArray: res })
    }
  }

  setChart = () => {

    const maxCount = this.state.freqArray.reduce(
      (acc, cur) => cur.count > acc ? cur.count : acc,
      1
    )
    console.log(`Max count: ${maxCount}`)
    console.log(`Plotting data: ${JSON.stringify(this.state.freqArray)}`)

    const toRender = (
      <VictoryChart width={140} height={140} style={{ labels:{ fontSize:4 } }}>
        <VictoryLabel x={50} y={40}
          text="Withdrawals this Week"
          style={{fontSize:4}}
        />
        <VictoryBar
          x="day"
          y="count"
          standalone={false}
          style={{ data: { strokeWidth: 0.25, fill: "#9c27b0" } }}
          data={this.state.freqArray}
        />
        <VictoryAxis
          domain={{ y: [0, maxCount] }}
          dependentAxis={true}
          label="Withdrawals"
          style={{ axisLabel: { fontSize: 4 }, tickLabels: { fontSize: 3 } }}
        />
        <VictoryAxis
          dependentAxis={false}
          domain={{ x: [0, 7]}}
          tickValues={[0, 1, 2, 3, 4, 5, 6, 7]}
          label="Day"
          style={{ axisLabel: { fontSize: 4 }, tickLabels: { fontSize: 3 } }}
        />
      </VictoryChart>
    );
    console.log(toRender);
    return toRender
  };

  _handleRefresh = async () => {
    await this.setTotal();
    await this.setAverage();
    await this.setFrequency();
    this.setState({ WithdrawalFrequency: this.setChart()});
  };

  componentDidMount = async () => {
    await this.setTotal();
    await this.setAverage();
    await this.setFrequency();
    this.setState({ WithdrawalFrequency: this.setChart()});
  };

  render = () => {
    const { classes } = this.props;
    const {WithdrawalFrequency} = this.state;

    return (
      <div className={classes.content}>
      <Card className={classes.card}>
      <CardContent>
        <Typography variant="h5" style={{marginBotton:"5%"}}>Withdrawal Summary Statistics</Typography>
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
                    {this.state.withdrawalTotal}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Average Token Value</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                  {this.state.withdrawalAverageToken.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Average ETH Value</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                  {this.state.withdrawalAverageWei.formatted}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <Button variant="contained" onClick={() =>this._handleRefresh()}>
            Refresh
          </Button>
      </Card>
      <Card className={classes.card}>
      <div style={{marginTop:"-20%"}}>
            {WithdrawalFrequency}
            </div>
      </Card>
      </div>
    );
  };
}

export const WithdrawalsStyled = withStyles(styles)(Withdrawals);
