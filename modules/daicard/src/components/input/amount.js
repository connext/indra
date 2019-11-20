import { InputAdornment, TextField } from "@material-ui/core";

import { Zero } from "ethers/constants";
import React, { useEffect, useState } from "react";

import { Currency } from "../../utils";
import { useDebounce } from "./utils";

export const useAmount = (initialAmount, max) => {
  const [display, setDisplay] = useState(initialAmount);
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const debounced = useDebounce(display, 400);
  useEffect(() => {
    let value;
    console.log(`Parsing value ${debounced}`);
    if (debounced === null || debounced === "") {
      setValue(Currency.DAI("0"));
      setError(undefined);
      return;
    }
    let error;
    try {
      value = Currency.DAI(debounced);
    } catch (e) {
      error = `Invalid Currency amount`;
    }
    if (value && max && value.wad.gt(max.toDAI().wad)) {
      error = `Channel balances are capped at ${max.toDAI().format()}`;
    }
    if (value && value.wad.lt(Zero)) {
      error = "Please enter a payment amount above 0";
    }
    setValue(error ? undefined : value);
    setError(error);
  }, [debounced]);
  return [
    { display, value, error },
    setDisplay,
    setError,
  ];
}

export const AmountInput = ({ amount, setAmount }) => {
  return (
    <div>
      <TextField
        error={!!amount.error}
        helperText={amount.error || " "}
        id="outlined-with-placeholder"
        InputProps={{ startAdornment: (<InputAdornment position="start">$</InputAdornment>) }}
        label="Amount"
        margin="normal"
        onChange={evt => setAmount(evt.target.value)}
        placeholder={"0.00"}
        required
        style={{ width: "100%" }}
        type="numeric"
        value={amount.display || ""}
        variant="outlined"
      />
      {/*
        <FormControl xs={12} className={classes.bodyForm}>
          <InputBase
            InputProps={{ endAdornment: (<span>$</span>) }}
            className={classes.valueInput}
            classes={{input: classes.valueInputInner}}
            onChange={evt => setAmount(evt.target.value)}
            placeholder={"$0.00"}
            required
            type="numeric"
            value={amount.display || ""}
          />
          {amount.error && (
            <FormHelperText className={classes.helperText}>{amount.error}</FormHelperText>
          )}
        </FormControl>
      */}
    </div>
  );
}
