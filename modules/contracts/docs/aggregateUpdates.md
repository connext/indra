*tl;dr:* When calculating the balance for an update which includes a pending deposit, pending withdraw, or both deposit and withdraw (into the same side of the channel), use the following heuristic:
```
1) if pending withdrawal > 0 and deposit = 0 then decrement the balance by withdrawal amount
2) if pending withdrawal > 0 and deposit > 0 and deposit > withdrawal then submit the previous state balance
3) if pending withdrawal > 0 and deposit > 0 and deposit <= withdrawal, decrement the balance by (withdrawal - deposit)
4) if pending withdrawal = 0 and deposit > 0 then submit the previous state balance
```

# Aggregate Updates

Normally, you deduct the withdrawal in advance from the offchain balances:

        // { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // { weiBalances: [0, .5], tokenBalances: [0, 100], pendingWeiUpdates: [0, 0, 0, 0.5], txCount: [2, 2] }
        // NOTE: pendingWeiUpdates: [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]

In this construct, the offchain balance represents the *operating balance available to spend*. So when you create a pending withdrawal, you move that amount *out of* the the `weiBalances` and *into* the pending withdrawals.

However, in the case where performer wants to do an exchange + withdrawal in a single tx (represented below), the ETH to fund the performer's ETH withdrawal comes from the hub's deposit not the offchain balance. As you'll notice below, the hub's deposit is on the performer's behalf as a `userDeposit`, not a `hubDeposit`, which the hub does because the user also signed over possession of their 100 BOOTY to the hub:

        // { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // { weiBalances: [0, .5], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 0.5], txCount: [2, 2] }
        // NOTE: pendingWeiUpdates: [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]

To my knowledge, this is the only case where we will have either the hub or user having BOTH a deposit AND a withdrawal in the same transactions—it would make very little sense for the hub to both deposit and withdraw for itself.

This `userDeposit -> userWithdraw` breaks how we were computing the resulting onchain balance for the user, because our calculations were assuming that the ETH was coming from the offchain balance, not the deposit. The following onchain balance update would be incorrect:

        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, .5], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 0.5], txCount: [2, 2] }
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 1
        channel.weiBalances[1] = weiBalances[1].add(pendingWeiUpdates[2]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

Now, we realized that we _could_ update the calculation to subtract the withdrawal amount from the onchain balances before it is saved, which would make this work:

        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, .5], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 0.5], txCount: [2, 2] }
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 0.5
        channel.weiBalances[1] = weiBalances[1].add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]); // <- SUBTRACT WITHDRAWAL
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

However, this would fail for the initial simple withdrawal case:

        // INIT { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST { weiBalances: [0, .5], tokenBalances: [0, 100], pendingWeiUpdates: [0, 0, 0, 0.5], txCount: [2, 2] }
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 0
        channel.weiBalances[1] = weiBalances[1].add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]); // <- SUBTRACT WITHDRAWAL
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

Arjun presented a solution which sums up the deposits and withdrawals first, and then, if the deposits are greater than the withdrawals, adds the remaining deposit to offhcain balance, and saves the result onchain. If the deposits are less than the withdrawals, the assumption is that the offchain balance has already accounted for the withdrawal, and should not be updated before it is saved onchain. The updated code is as follows:

        // NOTE: pendingWeiUpdates: [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] compiledWeiUpdate; // [hubUpdate, userUpdate]
        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

The key idea here is that the net of deposits + withdrawals is either negative, in which case it is applied offchain (and standard checks should ensure the net >= current balance) or positive, in which case they are only applied onchain. This helps enforce the invariant that the amount in the offchain balances is what is instantaneously available to spend. If the net is negative, then _even if_ the pending txs were to fail for some reason, because it is applied offchain, the user/hub would still not be allowed to spend *more* than their original balance, which the channel would revert to. If the net is -2, and my original balance is 10, then my balance would be updated offchain to be 8, so I wouldn't be able to spend more than 8, which would be fine even if the pending txs failed, because then I would stil have 10. Note that this doesn't apply to pending txs involving exchange, because those have timeouts, and are covered by the hueristic that neither the hub nor user should permit further state updates on a pending state update with a timeout.

Let's see how it does in a few test cases.

Simple withdrawal:

        // 1) if pending withdrawal > 0 and deposit = 0 then decrement the balance by withdrawal amount
        // INIT { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST { weiBalances: [0, .5], tokenBalances: [0, 100], pendingWeiUpdates: [0, 0, 0, 0.5], txCount: [2, 2] }
        // NOTE: compiledWeiUpdate[1] -> 0 (deposits are less than withdrawals)
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 0.5

        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

Performer withdrawal + exchange where deposits = withdrawals:

        // 3) if pending withdrawal > 0 and deposit > 0 and deposit <= withdrawal, decrement the balance by (withdrawal - deposit)
        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, .5], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 0.5], txCount: [2, 2] }
        // NOTE: compiledWeiUpdate[1] -> 0 (deposits are equal to withdrawals)
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 0.5

        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

An adapted version of performer exchange + withdrawal where the deposits > withdrawals:


        // 2) if pending withdrawal > 0 and deposit > 0 and deposit > withdrawal then submit the previous state balance
        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, 1], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 1, 0.5], txCount: [2, 2] }
        // NOTE: compiledWeiUpdate[1] -> 0.5 (deposits are greater than withdrawals)
        // EXPECT: channel.weiBalances[1] -> 1.5
        // RESULT: channel.weiBalances[1] -> 1.5

        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

An adapted version of performer exchange + withdrawal where the deposits < withdrawals:

        // 3) if pending withdrawal > 0 and deposit > 0 and deposit <= withdrawal, decrement the balance by (withdrawal - deposit)
        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, 0.5], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 1], txCount: [2, 2] }
        // NOTE: compiledWeiUpdate[1] -> 0 (deposits are less than withdrawals)
        // EXPECT: channel.weiBalances[1] -> 0.5
        // RESULT: channel.weiBalances[1] -> 0.5

        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

And finally, an adapted version of performer exchange + withdrawal where the deposits < withdrawals, and the withdrawal > initial balance:

        // 3) if pending withdrawal > 0 and deposit > 0 and deposit < withdrawal, decrement the balance by (withdrawal - deposit)
        // INIT: { weiBalances: [0, 1], tokenBalances: [0, 100], txCount: [1, 1] }
        // TEST: { weiBalances: [0, .3], tokenBalances: [100, 0], pendingWeiUpdates: [0, 0, 0.5, 1.2], txCount: [2, 2] }
        // NOTE: compiledWeiUpdate[1] -> 0 (deposits are less than withdrawals)
        // EXPECT: channel.weiBalances[1] -> 0.3
        // RESULT: channel.weiBalances[1] -> 0.3

        if (pendingWeiUpdates[2] > pendingWeiUpdates[3]) {
            compiledWeiUpdate[1] = pendingWeiUpdates[2].sub(pendingWeiUpdates[3]);
        } else {
            compiledWeiUpdate[1] = 0;
        }

        channel.weiBalances[1] = weiBalances[1].add(compiledWeiUpdate[1]);
        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[3]);
        recipient.transfer(pendingWeiUpdates[3]);

Suffice to say, deposits are credited to the balance offchain as part of a state transition that introduces pending operations IF AND ONLY IF the withdrawal exceeds the deposit amount. If the withdrawal amount exceeds the deposit amount, the onchain calculations will assume that the deposit amount has already been credited to the user's balance and WILL NOT add it again.

In Arjun's words: The reason I think it works is: EITHER your delta is positive, in which case you add it onchain as a deposit OR your delta is negative in which case you add it offchain before you submit.
