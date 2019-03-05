import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import get from "../get";
import { VictoryChart, VictoryLine, VictoryLabel, VictoryAxis } from "victory";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

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
      withdrawalAverageWei: null,
      withdrawalAverageToken: null,
      withdrawalTotal: null,
      withdrawalBreakdown: null,
      freqArray:null,
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
      this.setState({ withdrawalTotal: "N/A" });
    }
  };

  setFrequency = async() =>{
    const res = get(`withdrawals/frequency`);
    if (res.data){
      this.setState({freqArray: res.data})
    }
  }

  setChart = () => {
    // // TESTING DATA
    // let data = [
    //   { day: 1, count: 10 },
    //   { day: 2, count: 14 },
    //   { day: 3, count: 8 }
    // ];
    // const toRender = (
    //   <VictoryChart width={140} height={140}
    //     style={{
    //       labels:{
    //         fontSize:4
    //       }
    //     }}>
    //       <VictoryLabel x={50} y={40}
    //         text="Withdrawals this Week"
    //         style={{fontSize:4}}
    //       />
    //       <VictoryLine
            
    //         x="day"
    //         y="count"
    //         standalone={false}
    //         style={{ data: { strokeWidth: 0.1 } }}
    //         data={data}
    //       />
    //       <VictoryAxis
    //         domain={{y: [0, 100] }}
    //         dependentAxis={true}
    //         label="Withdrawals"
    //         style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
    //       />
    //       <VictoryAxis
    //         dependentAxis={false}
    //         domain={{ x: [0, 7]}}
    //         tickValues={[0, 1, 2, 3, 4, 5, 6, 7]}
    //         label="Day"
    //         style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
    //       />
    // </VictoryChart> 
    // );
    // console.log(toRender);
    // return toRender;

    if (this.state.freqArray) {
      // TESTING DATA
      // let data = [
      //   {day:"1", count:10},
      //   {day:"2", count:14},
      //   {day:"3", count:8}
      // ]

    const toRender = (
      <VictoryChart width={140} height={140}
        style={{
          labels:{
            fontSize:4
          }
        }}>
          <VictoryLabel x={50} y={40}
            text="Withdrawals this Week"
            style={{fontSize:4}}
          />
          <VictoryLine
            
            x="day"
            y="count"
            standalone={false}
            style={{ data: { strokeWidth: 0.1 } }}
            data={this.state.freqArray}
          />
          <VictoryAxis
            domain={{y: [0, 100] }}
            dependentAxis={true}
            label="Withdrawals"
            style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
          />
          <VictoryAxis
            dependentAxis={false}
            domain={{ x: [0, 7]}}
            tickValues={[0, 1, 2, 3, 4, 5, 6, 7]}
            label="Day"
            style={{ axisLabel: { fontSize: 2 }, tickLabels: { fontSize: 2 } }}
          />
    </VictoryChart> 
    );
    console.log(toRender);
    return toRender
    } else {

      console.warn(`Missing data for chart`)
    }
  };

  componentDidMount = async () => {
    await this.setTotal();
    await this.setAverage();
    await this.setFrequency();
  };

  render = () => {
    const { classes } = this.props;
    const WithdrawalFrequency = this.setChart();
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
                  {this.state.withdrawalAverageToken}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th" scope="row">
                    <Typography variant="h6">Average Wei Value</Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                  {this.state.withdrawalAverageWei}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
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
