import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import get from '../get';


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
      avgWeiBalance:null,
      avgTokenBalance:null
    }
  }

  setChannels = async() => {
    const res = await get(`channels/open`)
    if (res) {
      this.setState({openChannels: res.count});
    } else {
      this.setState({openChannels: 0});
    }
  }

  setChannelBalances = async() => {
    const res = await get(`channels/averages`)
    if (res) {
      this.setState({avgTokenBalance: res.avg_tokens, avgWeiBalance: res.avg_wei});
    } else {
      this.setState({avgTokenBalance: 0, avgWeiBalance: 0});
    }
  }

  componentDidMount = async() =>{
    await this.setChannels()
    await this.setChannelBalances()
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
                  Average Channel Wei Balance
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                {this.state.avgWeiBalance}
                </TableCell>
              </TableRow>
              <TableRow >
                <TableCell component="th" scope="row">
                  <Typography variant="h6">
                  Average Channel Token Balance
                  </Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                {this.state.avgTokenBalance}
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>

        </CardContent>
      </Card>
    );
  };
}
  
  export const ChannelInfoCardStyled = withStyles(styles)(ChannelInfoCard);
