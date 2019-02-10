Personal
- I should learn typescript

Client
- lots of todos
- why not use client functions for contract unit tests?
  - hubAuthorizedUpdate
  - updateThreadState
  - etc...
  - seems like client is specific to wallet / expects a hub
  - will the hub be running the client code too?
    - only some static functions
- there is room for a light middleware module that wraps the contract functions
  - takes a channel data object, calls functions on that
  - can be used on the hub side as well
  - risk is moving towards OO programming
- update openThread to not hit the hub
- where are the docs?
  - are they up to date?
- how good are the tests?
  - how are they conducted?
    - ?
  - what is tested?
    - Actual client method tests are skipped
  - how much overlap is there with the contract tests?
    - ?
- decouple signing from generating state updates
  - createThreadStateUpdate
  - createChannelStateUpdate
- why does closeThread hit the API endpoint (getThreadByParties?)

Client Architecture
- Core Data Structure
  - constructor (web3, db, ChannelManager, token, hub)
    - this part exists and is good
    - why is Validation its own object?
      - Hub and Wallet were having trouble importing them
      - Rahul wanted to import Validation separately
      - Utils is inspired by web3.utils
  - channel instance
    - current state
    - previous state
    - threads[]
      - initial state
      - previous state
      - current state
    - history
      - all actions in chronological order
  - static methods
    - hub is optimized to not need instances
      - doesn't keep individual channels in memory for very long (stateless)
      - API -> Service -> Validation -> Update -> Persist -> Respond
      - hub still benefits from code re-use on static methods
      - probably best as its own lib within the repo
  - instance methods (use static methods)
    - more geared towards wallet
      - keep user's channel in local storage / memory
    - also helps for contract testing
    - might help for hub testing as well
  - persistance?
    - optional
      - hub uses it's own sophisticated system
      - on wallet it would simplify logic
        - auto-persist state updates
        - should be same as machinomy library
- State Transition Logic
  - updateChannel (pay, exchange, open/close thread)
  - updateThread (pay)
- Validation Logic (should use state transition logic)
  - isValidChannelUpdate (pay, exchange, open/close thread)
  - isValidThreadUpdate (pay)
- Hub API wrapper
  - execute using local instance data
    - e.g. POST to open thread w/ updated channel state (to include new thread)
      and initial thread state
  - Authentication
    - checking signatures on state objects themselves
    - TODO figure out how auth is done when sending unsigned payloads (e.g.
      request collateral)
    - TODO are there sessions?
  - Channel Endpoints
    - POST request deposit/withdrawal/exchange/collateral
    - POST update
    - POST sync
    - GET channel(user)
  - Thread Endpoints
    - POST open/update/close thread
    - GET thread(user)
    - GET thread initial states
    - GET incoming threads for a user
  - Retry Logic / Settings
  - Failure Handling
    - e.g. what happens if you open a thread locally, and the hub rejects it?
    - need to do 2-phase commits for all state updates
      - if hub rejects proposed state update, rollback
- ChannelManager.sol wrapper
  - execute contract calls using local instance data
    - e.g.
- Watcher (BACKLOG)
  - listen on contract events and respond / alert
  - optional
    - hub has chainsaw
    - wallet would use it to protect user (while they are online)

Hub
- has its own onchain tx service
- doesnt use connext client except for some static util functions

Wallet

Contract Tests
- need to rewrite ffStartThread -> beforeEach
- inside of ffStartThread, replace with new instance of Connext client
  - use connext methods for openThread

Call With Layne 11/24
- Objectives
  - Full code review of Connext client and tests
  - Write tests for 54 withdrawal cases
  - docs are at docs.connext.network, but are out of date
  - testing
    - hub api wrapper
      - doesn't make sense to mock
        - would need to test request payload + handling response range
      - probably best to do integration
        - Wallet -> Hub
    - validation
      - unit testing in isolation
    - utils
      - unit testing in isolation
    - contract stuff
      - ??? maybe combine with actual contract tests
  - decouple signing from generating state updates
    - createThreadStateUpdate
    - createChannelStateUpdate
  - where / when does an instance update its internal state?
    - so far I don't see it doing so
    - TODO decide if wallet / client should manage state
  - why does closeThread hit the API endpoint (getThreadByParties?)
    - by relying on the hub for state, it allows the hub to lie
      - for multi-device we still rely on the hub for state
      - BUT, we want to be careful about HOW we get state
      - Ideally always through *sync* method





