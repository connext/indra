import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import axios from "axios";

const styles = theme => ({
    card: {
        minWidth: 275,
        textAlign:"left"
      },
    table: {
      maxWidth:"50%"
    }
    });


class ChannelInfoCard extends Component{
  constructor(props) {
    super(props)
    this.state={
      openChannels:null,
      unopenedChannels:null,
      avgWeiBalance:{
        raw:null,
        formatted:null
      },
      avgTokenBalance:{
        raw:null,
        formatted:null
      }
    }
  }

  setOpenChannels = async() => {
    const url = `${this.props.urls.api}/channels/open`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({openChannels: res.count});
    } else {
      this.setState({openChannels: 0});
    }
  }

  setUnopenedChannels = async() => {
    const url = `${this.props.urls.api}/channels/notopen/count`
    const res = (await axios.get(url)).data || null
    if (res) {
      this.setState({unopenedChannels: res.count});
    } else {
      this.setState({unopenedChannels: 0});
    }
  }

  setChannelBalances = async() => {
    const { web3 } = this.props;
    const url = `${this.props.urls.api}/channels/averages`
    const res = (await axios.get(url)).data || null
    if (res) {
      let tokenDeposit = String(Math.trunc(res.avg_tokens));
      let weiDeposit = String(Math.trunc(res.avg_wei));

      console.log(`tokens: ${tokenDeposit}, wei: ${weiDeposit}`)
      this.setState(state => {
                    state.avgTokenBalance.raw = res.avg_tokens
                    state.avgTokenBalance.formatted = web3.utils.fromWei(tokenDeposit)
                    state.avgWeiBalance.raw = res.avg_wei
                    state.avgWeiBalance.formatted = web3.utils.fromWei(weiDeposit)
                    return state});
    } else {
      this.setState({avgTokenBalance: 0, avgWeiBalance: 0});
    }
  }

  _handleRefresh = async() =>{
    await this.setOpenChannels()
    await this.setUnopenedChannels()
    await this.setChannelBalances()
  }

  componentDidMount = async() =>{
    await this._handleRefresh()
  }

  render(){
    const { classes } = this.props;
    return (
      <Card className={classes.card}>
        <CardContent>
        <Table className={classes.table}>
          {/* <TableHead>
            <TableRow>
              <TableCell/>
              <TableCell>Number</TableCell>
            </TableRow>
          </TableHead> */}
          <TableBody>
              <TableRow >
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                  Open Channels
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.openChannels}
                </TableCell>
              </TableRow>
              <TableRow >
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                  Non-open Channels
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  {this.state.unopenedChannels}
                </TableCell>
              </TableRow>
              <TableRow >
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                  Average Channel Wei Balance
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                {this.state.avgWeiBalance.formatted}
                </TableCell>
              </TableRow>
              <TableRow >
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                  Average Channel Token Balance
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                {this.state.avgTokenBalance.formatted}
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>

        </CardContent>
        <Button variant="contained" onClick={() =>this._handleRefresh()}>
            Refresh
          </Button>
      </Card>
    );
  };
}

export const ChannelInfoCardStyled = withStyles(styles)(ChannelInfoCard);
