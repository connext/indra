import React, { Component } from "react";
//import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
//import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import get from '../get';


const styles = theme => ({
    card: {
        minWidth: 275,
        textAlign:"left"
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
