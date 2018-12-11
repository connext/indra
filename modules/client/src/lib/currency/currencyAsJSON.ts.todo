import {ICurrency} from './Currency' 

// only JSONs of currency without all the methods that come with Currency or CUrrencyCOnvertable should be stored in WorkerState
export default function currencyAsJSON(c: ICurrency): ICurrency {
  return {
    amount: c.amount,
    type: c.type,
  }
}
