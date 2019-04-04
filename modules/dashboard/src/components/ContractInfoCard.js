import React from "react";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";

const styles = theme => ({
    card: {
        minWidth: 275
      },
      pos: {
        marginBottom: 12
      }
    });

const ContractInfoCard = props => {
  const { classes, wei, token, loading, handleRefresh, contractAddress } = props;
  return (
    <Card className={classes.card}>
      <CardContent>
        {loading ? (
          <Typography variant="h5" component="h2">
            Loading...
          </Typography>
        ) : (
          <>
            <Typography className={classes.pos} color="textSecondary">
              <a href={`https://etherscan.io/address/${contractAddress}`} target="_blank" rel="noopener noreferrer">{contractAddress}</a>
            </Typography>
            <Typography variant="h5" component="h2">
              {parseFloat(wei.formatted).toFixed(2)}... ETH ({wei.raw} Wei)
            </Typography>
            <Typography variant="h5" component="h2">
              ${parseFloat(token.formatted).toFixed(2)}... DAI ({token.raw} Dei)
            </Typography>
          </>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" onClick={handleRefresh}>
          Refresh
        </Button>
      </CardActions>
    </Card>
  );
};

export const ContractInfoCardStyled = withStyles(styles)(ContractInfoCard);
