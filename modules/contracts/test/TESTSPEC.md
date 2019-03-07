# Test Specification

How to use this doc: 

cmd+f the following,

- REDALERT => vulnerabilities in contract that need to be fixed asap.
- TODO => things to, uhh... do.
- TESTME => items which still need to be unit tested. (Used to keep track of incomplete tests if we update spec and also to keep track of newly testable items from notes.)
- PUNT => items which will be completed on next release.

## Happy Case Tests

### hubAuthorizedUpdate

Unit: 

Expect
1. Fails when sent wei (not payable)
    - with "VM Exception while processing transaction: revert"
1. Fails if `msg.sender` is not hub
    - with TODO
2. Fails if channel status is not `Open`.
    - with "channel must be open"
3. Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
4. Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
5. Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
6. Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
7. Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
8. Fails if the total pending wei deposits for both sides of the channel are greater than the hub's reserve wei
    - with "insufficient reserve wei for deposits"
9. Fails if the total pending token deposits for both sides of the channel are greater than the hub's reserve tokens
    - with "insufficient reserve tokens for deposits"
12. Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
13. Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"
14. Fails if user is hub
    - with "user can not be hub"
15. Fails if user is channel manager
    - with "user can not be channel manager"
16. Fails if address in signature is not the address of channel manager
    - fails with "user signature invalid"
17. Fails if user or recipient is not correct in state
    - fails with "user signature invalid"
18. Fails if weiBalances are incorrect in state
    - fails with "user signature invalid"
19. Fails if tokenBalances are incorrect in state
    - fails with "user signature invalid"
20. Fails if pendingWeiUpdates are incorrect in state
    - fails with "user signature invalid"
21. Fails if pendingTokenUpdates is incorrect in state
    - fails with "user signature invalid"
22. Fails if txCount is incorrect in state
    - fails with "user signature invalid"
23. Fails if threadRoot is incorrect in state
    - fails with "user signature invalid"
    - note: this should be empty for this release! TODO verify that this is validated on client/hub 
24. Fails if threadCount is incorrect in state
    - fails with "user signature invalid"
    - note: this should be zero for this release! TODO verify that this is validated on client/hub
25. Fails if timeout is incorrect in state
    - fails with "user signature invalid"
26. Fails if user is not the signer of sigUser
    - with "user signature invalid"
27. TESTME totalChannelWei is increased by deposits and decreased by withdrawals as expected in success case
28. TESTME same as above for tokens
29. TESTME verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
30. TESTME same for tokens
31. TESTME verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
32. TESTME verify that channelBalances[0] stays the same in the case that withdraws >= deposits
33. TESTME same as above for channelBalances[1] in case where deposits are greater than withdrawals
34. TESTME same as above for channelBalances[1] in case where withdrawals >= deposits
35. TESTME Fails if token transfer for withdrawal fails
    - with "user token withdrawal transfer failed"
    - TODO how could this fail?

Scenario:

1. user deposit
2. hub deposit
3. user withdrawal
4. hub withdrawal
5. user deposit + hub deposit
6. user deposit + hub withdrawal
7. user withdrawal + hub deposit
8. user withdrawal + hub withdrwal
9. Performer withdrawal booty -> eth where hub withdraws collateral
10. user withdrawal booty -> eth where hub withdraws collateral
11. recipient is different than user

TODO: some of these will be covered by tests 27-34, do we need to test all scenarios?
TODO: some of these will only apply to one of `userAuthorizedUpdate` or `hubAuthorizedUpdate`. figure out which one

### userAuthorizedUpdate
Expect
1. Fails if `msg.value` is not equal to `pendingWeiUpdates[2]`
    - with "msg.value is not equal to pending user deposit"
2. Fails if channel status is not `Open`.
    - with "channel must be open"
3. Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
4. Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
5. Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
6. Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
7. Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
10. Fails if sender is not hub and hub wei deposit is greater than hub reserve wei
    - with "insufficient reserve wei for deposits"
11. Fails if sender is not hub and hub token deposit is greater than hub reserve token
    - with "insufficient reserve tokens for deposits"
12. Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
13. Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"
14. Fails if `msg.sender` is hub
    - with "user can not be hub"
15. Fails if `msg.sender` is channel manager
    - This one is impossible to test without changing contract itself
16. Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid"
17. Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid"
18. Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid"
19. Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid"
20. Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid"
21. Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid"
22. Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" 
23. Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid"
24. Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid"
25. Fails if timeout is incorrect in state
    - fails with either "hub signature invalid"
26. Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
27. TESTME Fails if user token transferFrom fails (token transfer not approved)
    - with "user token deposit failed"
28. TESTME verify that totalChannelWei is increased by depposits and decreased by withdrawals as expected in success case
29. TESTME same for tokens
30. TESTME verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
31.  TESTME same for tokens
32. TESTME verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
33. TESTME verify that channelBalances[0] stays the same in the case that withdraws >= deposits
34. TESTME same as above for channelBalances[1] in case where deposits are greater than withdrawals
35. TESTME same as above for channelBalances[1] in case where withdrawals >= deposits
36. TESTME Fails if token transfer for withdrawal fails
    - with "user token withdrawal transfer failed"
    - TODO how could this fail?

Scenario:

1. user deposit
2. hub deposit
3. user withdrawal
4. hub withdrawal
5. user deposit + hub deposit
6. user deposit + hub withdrawal
7. user withdrawal + hub deposit
8. user withdrawal + hub withdrwal
9. Performer withdrawal booty -> eth where hub withdraws collateral
10. user withdrawal booty -> eth where hub withdraws collateral
11. recipient is different than user

TODO: some of these will be covered by tests 27-34, do we need to test all scenarios?
TODO: some of these will only apply to one of `userAuthorizedUpdate` or `hubAuthorizedUpdate`. figure out which one

## Unilateral Channel Tests

### startExit

1. Fails if user is hub 
    - with "user can not be hub"
2. Fails if user is the channel manager
    - with "user can not be channel manager"
3. Fails if channel is not open
    - with "channel must be open"
4. Fails if the function is called by someone other than the hub or the passsed in user
    - with "exit initiator must be user or hub"
5. verify that `exitInitiator`, `channelClosingTime` and `status` are set correctly in success case

### startExitWithUpdate

1. Fails if channel status is not open
    - with "channel must be open"
2. Fails if `msg.sender` is not the hub or the submitted user
    - with "exit initiator must be user or hub"
3. Fails if `timeout` is nonzero
    - with "can't start exit with time-sensitive states"
4. Fails if `msg.sender` is hub
    - with "user can not be hub"
5. Fails if `msg.sender` is channel manager
    - with "user can not be channel manager"
6. Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
7. Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
8. Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
9. Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
10. Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
11. Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
12. Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
13. Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
14. Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
15. Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
16. Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
17. Fails if user is not the signer of sigUser
    - with "user signature invalid"
17. Fails if `txCount[0]` is not higher than the current `txCount[0]`
    - with "global txCount must be higher than the current global txCount"
18. Fails if `txCount[1]` is strictly less than current `txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
19. Fails if offchain wei balances exceed onchain wei
    - with "wei must be conserved"
20. Fails if offchain token balances exceed onchain tokens
    - with "tokens must be conserved"
21. TESTME totalChannelWei is increased by deposits and decreased by withdrawals as expected in success case
22. TESTME same as above for tokens
23. TESTME verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
24. TESTME same for tokens
25. TESTME verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
26. TESTME verify that channelBalances[0] stays the same in the case that withdraws >= deposits
27. TESTME same as above for channelBalances[1] in case where deposits are greater than withdrawals
28. TESTME same as above for channelBalances[1] in case where withdrawals >= deposits
TODO Test possible states for revertPendingUpdates

### emptyChannelWithChallenge
1. Fails if channel is not in dispute status
    - with "channel must be in dispute"
2. Fails if the closing time has passed
    - with "channel closing time must not have passed"
3. Fails if `msg.sender` initiated the exit
    - with "challenger can not be exit initiator"
4. Fails if `msg.sender` is not either the hub or the submitted user
    - with "challenger must be either user or hub"
5. Fails if timeout is nonzero
    - with "can't start exit with time-sensistive states"
6. Fails if `msg.sender` is hub
    - with "user can not be hub"
7. Fails if `msg.sender` is channel manager
    - with "user can not be channel manager"
8. Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
9. Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
10. Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
11. Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
12. Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
13. Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
14. Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
15. Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
16. Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
17. Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
18. Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
19. Fails if user is not the signer of sigUser
    - with "user signature invalid"
20. Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
21. Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
22. TESTME Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
23. TESTME Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
24. TESTME totalChannelWei is increased by deposits and decreased by withdrawals as expected in success case
25. TESTME same as above for tokens
26. TESTME verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
27. TESTME same for tokens
28. TESTME verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
29. TESTME verify that channelBalances[0] stays the same in the case that withdraws >= deposits
30. TESTME same as above for channelBalances[1] in case where deposits are greater than withdrawals
31. TESTME same as above for channelBalances[1] in case where withdrawals >= deposits
TODO Test possible states for revertPendingUpdates
32. TESTME Fails if token transfer fails 
    - with "user token withdrawal transfer failed"
33. TESTME verify correct `totalChannelWei` and `totalChannelToken` decrease in success case. (also other vars)

### emptyChannel

1. Fails if user is hub
    - with "user can not be hub"
2. Fails if user is channel manager
    - with "user can ot be channel manager"
3. Fails if channel is not in dispute status
    - with "channel must be in dispute"
4. Fails if channel closing time has not passed and `msg.sender` is the exit initiator
    - with "channel closing time must have passed or msg.sender must be non-exit-initiating party"
5. Fails if token transfer fails
    - with "user token withdrawal transfer failed"
6. TESTME verify that correct amounts are transferred during success case and that all state is updated correctly

## Unilateral Thread Tests

MOSTLY PUNT

## ---- Arjun Temporary Notes ----

#### startExit

Test requires
- Fails if user is hub 
    - with "user can not be hub"
- Fails if user is the channel manager
    - with "user can not be channel manager"
- Fails if channel is not open
    - with "channel must be open"
- Fails if the function is called by someone other than the hub or the passsed in user
    - with "exit initiator must be user or hub"

Test inputs
- In what ways can we break user input here?
    - Can you start exit for a random user?
        - Would fail require if you aren't the submitted user (or if you aren't the hub)
        - What happens to the hub if I create a random address and dispute a channel that was never acted on? TODO: asked wolever, we should put this in a ticket and verify it doesnt break the hub.
    - Make sure that user != hub or channel manager address in _all_ functions.
        - startExit is okay, so is any function which calls `_verifySig`
        - edit: thread methods don't check this, but instead check that the channel is in ThreadDispute, which can only be entered by calling a fn that checks this.

Test states
- Only internal state that can be manipulated here is channel, which depends on user input
- We should verify that `exitInitiator`, `channelClosingTime` and `status` are set correctly

#### startExitWithUpdate

Test requires
- Fails if channel status is not open
    - with "channel must be open"
    - TODO verify that every function can _only_ be called in a specific channel state. Note we should make sure that we use hard "status == X" rather than "status != not(X)"
- Fails if `msg.sender` is not the hub or the submitted user
    - with "exit initiator must be user or hub"
- Fails if `timeout` is nonzero
    - with "can't start exit with time-sensitive states"
- all verifysig conditions
- Fails if `txCount[0]` is not higher than the current `txCount[0]`
    - with "global txCount must be higher than the current global txCount"
    - TODO check to make sure that all state comparative functions have this requirement
- Fails if `txCount[1]` is strictly less than current `txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
    - TODO check to make sure that all state comparative functions have this requirement
- Fails if offchain wei balances exceed onchain wei
    - with "wei must be conserved"
- Fails if offchain token balances exceed onchain tokens
    - with "tokens must be conserved"

Test inputs
- How can we break user?
    - TODO verify that recipient is used correctly everywhere
    - TESTME test where recipient != user
    - what happens if you submit the wrong user? 
        - either you fail msg.sender == user
        - or you're hub
        - or you don't actually have anything in the channel because you're using a random address. See notes in startexit section
- How can we break weiBalances? tokenBalances? 
    - gets checked in verifySig and "Dont Sign Dumb Shit" validators in client
- How can we break pending Wei/Token updates?
    - gets checked in verfiySig and "Dont Sign Dumb Shit" validators in client
    - note we should enumerate through different states here
- How can we break txCount and timeout??
    - same as above
- How can we break threadRoot and threadCount?
    - TODO make sure we explicitly require these to be 0/empty on client/hub

Test states
- Same as for `_applyPendingUpdates`
- same as for `_revertPendingUpdates`
- TESTME validate that `txCount`, `threadRoot`, `threadCount`, `exitInitiator`, `channelClosingTime` and `status` are set appropriately in success case.

#### emptyChannelWithChallenge

Validation sanity check:
- Validate that function cannot be called on a channel that is in the wrong status or whose dispute time has already expired
- Validate the sender is the correct person and not the exit initiator
- Validate inputs with sig
- Validate that submitted state is not being replayed
- Validate that the total amount of funds within the channel is not being changed

Test requires:
- Fails if channel is not in dispute status
    - with "channel must be in dispute"
- Fails if the closing time has passed
    - with "channel closing time must not have passed"
- Fails if `msg.sender` initiated the exit
    - with "challenger can not be exit initiator"
- Fails if `msg.sender` is not either the hub or the submitted user
    - with "challenger must be either user or hub"
- Fails if timeout is nonzero
    - with "can't start exit with time-sensistive states"
- All verifySig requires
- Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
- Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
- Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
- Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
- Fails if token transfer fails 
    - with "user token withdrawal transfer failed"

Test inputs


#### _verifyAuthorizedUpdate

Test requires
- Fails if channel status is not `Open`.
    - with "channel must be open"
- Fails if timeout is not 0 and `timeout <= now`
    - with "the timeout must be zero or not have passed"
- Fails if `txCount[0] <= channel.txCount[0]`
    - with "global txCount must be higher than the current global txCount"
- Fails if `txCount[1] < channel.txCount[1]`
    - with "onchain txCount must be higher or equal to the current onchain txCount"
- Fails if wei balances are greater than `channel.weiBalances[2]`
    - with "wei must be conserved"
- Fails if token balances are greater than `channel.tokenBalances[2]`
    - with "tokens must be conserved"
- Fails if sender is hub and the total pending wei deposits for both sides of the channel are greater than the hub's reserve wei
    - with "insufficient reserve wei for deposits"
- Fails if sender is hub and the total pending token deposits for both sides of the channel are greater than the hub's reserve tokens
    - with "insufficient reserve tokens for deposits"
- Fails if sender is not hub and hub wei deposit is greater than hub reserve wei
    - with "insufficient reserve wei for deposits"
- Fails if sender is not hub and hub token deposit is greater than hub reserve token
    - with "insufficient reserve tokens for deposits"
- Fails if the current total channel wei + both deposits is less than the final balances + both withdrawals
    - with "insufficient wei"
- Fails if the current total channel tokens + both deposits is less than the final balances + both withdrawals
    - with "insufficient token"

Test inputs
- In what ways can you break `channel`?
    - Can you instantiate the "wrong" channel? I.e. can Alice call `userAuthorizedUpdate` for Bob's channel?
        - No because `userAuthorizedUpdate` instantiates channel with msg.sender
        - Hub can do this, but this would get caught in the sig verification.
    - Can the hub call `hubAuthorizedUpdate` and instantiate a channel with itself?
        - Yes. There doesn't appear to be anything stopping this behavior?
        - What happens here?
            - Hub's self-channel status could be open -> this is ok
            - Hub's passed in txCount could be fake or misrepresent state -> this is bad insofar as hub can easily spoof a state with itself!
            - Hub's self-channel total balances (including threads) could be greater than it's available balance in the channel -> this is ok
        - Edit: this gets checked in verifySig
    - Can the hub call `hubAuthorizedUpdate` and instantiate a channel with the contract?
        - Edit: gets checked in verifySig
- In what ways can you break `txCount`?
    - Can txCount in the calling function be different than the passed in input? i.e. can the state input data be mismatched with count?
        - It can. You submit txCount along with all variables to `hubAuthorizedUpdate` or `userAuthorizedUpdate` which call this function immediately.
        - This is not an issue because it fails in sig verification
- In what ways can you break `weiBalances`?
    - You can pass in a random weiBalance not associated with state
        - Would fail sig verification. 
- In what ways can you break `tokenBalances`?
    - You can pass in random tokenBalace not associated with state
        - Would fail sig verification.
    - Token contract is specified in constructor, no vulns there.
- In what ways can you break pending wei/token updates?
    - Where do we check to make sure that deposit == msg.value?
        - Only need to check this for user update -> we require here that msg.value == user deposit.
        - What happens if user deposits into hub side? -> I guess they're just donating to hub? TODO verify this
    - What happens if user gives false values for deposit/withdraw?
        - Gives nonzero hub deposit -> hub would have had to sign so it's ok
        - This gets caught in sig verification.
- In what ways can you break `timeout`?
    - Timeout can be in 3 states: 0, less than now or greater than now.
    - Can we pass in timeout from other channel or falsify?
        - Gets caught in sig verification.
- In what ways can you break `isHub`?
    - Set when calling user or hub authorized update.
    - `hubAuthorizedUpdate` can only be called by Hub and sets `isHub` to true.
    - `userAuthorizedUpdate` can be called by anyone but uses msg.sender to instantiate channel. Hub can instantiate channel with self or contract here and enter a state where isHub is false even when hub calls.
        - edit: This gets checked in verifySig 

#### _applyPendingUpdates

Test requires
- N/A

Test inputs
- Inputs are verified by sig verification previously

Test states
- Need to verify all code paths here
- verify that channelBalances[0] is successfully updated based on pending deposit withdraw in the case that deposits are greater than withdrawals
- verify that channelBalances[0] stays the same in the case that withdraw is >= deposit
- same as above for channelBalances[1] in case where deposits are greater than withdrawals
- same as above for channelBalances[1] in teh case where withdrawals >= deposits

#### _revertPendingUpdates
#### _updateChannelBalances

Test requires
- N/A

Test inputs
- Inputs are verified by sig verification previously

Test states
- verify that totalChannelWei is increased by depposits and decreased by withdrawals as expected in success case
- same for tokens
- verify that channel total balances (weiBalances[2]) are increased by deposits and decreased by withdrawals as expected in success case
- same for tokens

#### _verifySig

Test requires
- Fails if user is hub
    - with "user can not be hub"
- Fails if user is channel manager
    - with "user can not be channel manager"
- Fails if address in signature is not the address of channel manager
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if user or recipient is not correct in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if weiBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if tokenBalances are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if pendingWeiUpdates are incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if pendingTokenUpdates is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if txCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if threadRoot is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be empty for this release! TODO verify that this is validated on client/hub 
- Fails if threadCount is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
    - note: this should be zero for this release! TODO verify that this is validated on client/hub
- Fails if timeout is incorrect in state
    - fails with either "hub signature invalid" or "user signature invalid"
- Fails if hub is not the signer of sigHub
    - with "hub signature invalid"
- Fails if user is not the signer of sigUser
    - with "user signature invalid"

Test inputs
- In what ways can we break `user`?
    - If it's not the expected input, gets caught in sig verification
- Same for `weiBalances`, `tokenBalances`, `pendingWeiUpdates`, `pendingTokenUpdates`, `txCount`, `threadRoot`, `threadCount`, `timeout`.
    - Signatures make this an offchain problem, so client _needs_ to conform to the "Dont Sign Dumb Shit" heuristic.
- Is there any way to force an incorrect sigHub/sigUser to deny this verification?
    - Client again should be checking for this to stop indisputable states.
- In what ways can we break `checks` boolean?
    - Only possible if either hub can call `userAuthorizedUpdate` or user can call `hubAuthorizedUpdate`
        - user can't cause hub update is onlyHub
        - hub can't cause user update uses msg.sender for user and verifySig requires that user != hub. 

#### _verifyThread

PUNT

#### _isContained

PUNT
