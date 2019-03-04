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

class GasCostCard extends Component{
  constructor(props) {
    super(props)
    this.state={
      gasTotal:null,
      gasLastWeek:null,
      gasLastDay:null
    }
  }

  setGas = async() => {
    const res = await get(`gascost/all`)
    if (res && res.sum){
      this.setState({gasTotal: res.sum});
    }else{
      this.setState ({gasTotal: 0})
    }
  }

  setGasLastWeek = async() => {
    const res = await get(`gascost/trailingweek`)
    if (res && res.sum) {
        this.setState({gasLastWeek: res.sum});
    } else {
        this.setState ({gasLastWeek: 0})
    }
  }

  setGasLastDay = async() => {
    const res = await get(`gascost/trailing24`)
    if(res && res.sum){
      this.setState({gasLastDay: res.sum});
      }else{
        this.setState ({gasLastDay: 0})
      }  }

  componentDidMount = async() =>{
    await this.setGas()
    await this.setGasLastDay()
    await this.setGasLastWeek()
  }

  render(){
    const { classes } = this.props;
    return (
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h4">Gas Paid by Hub</Typography>
          <Typography variant="h6">
          Last 24 hours: {this.state.gasLastDay}
          </Typography>
          <Typography variant="h6">
          Last week: {this.state.gasLastWeek}
          </Typography>
          <Typography variant="h6">
          Total:  {this.state.gasTotal}
          </Typography>

        </CardContent>
      </Card>
    );
  };
}
  
  export const GasCostCardStyled = withStyles(styles)(GasCostCard);
