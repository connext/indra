import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import axios from 'axios';


const styles = theme => ({
    card: {
        minWidth: 275
      },
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
    const res = await axios.get(`http://localhost:9999/channels/open`)
    console.log(res)
    this.setState({openChannels: res.data[0].count});
  }

  setChannelBalances = async() => {
    const res = await axios.get(`http://localhost:9999/channels/averages`)
    console.log(res)
    this.setState({avgTokenBalance: res.data[0].avg_token,
                    avgWeiBalance: res.data[0].avg_wei});
  }

  componentDidMount = async() =>{
    this.setChannels()
    //this.setChannelBalances()
  }

  render(){
    const { classes } = this.props;
    return (
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h4">
          Open Channels: {this.state.openChannels}
          </Typography>
          <Typography variant="h4">
          Average Wei Balance: {this.state.avgWeiBalance}
          </Typography>
          <Typography variant="h4">
          Average Token Balance: {this.state.avgTokenBalance}
          </Typography>
        </CardContent>
      </Card>
    );
  };
}
  
  export const ChannelInfoCardStyled = withStyles(styles)(ChannelInfoCard);