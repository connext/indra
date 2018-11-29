pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "./lib/ECTools.sol";
import "./lib/ERC20.sol";
import "./lib/SafeMath.sol";

contract ChannelManager {
    using SafeMath for uint256;

    string public constant NAME = "Channel Manager";
    string public constant VERSION = "0.0.1";

    address public hub;
    uint256 public challengePeriod;
    ERC20 public approvedToken;

    uint256 public totalChannelWei;
    uint256 public totalChannelToken;

    event DidHubContractWithdraw (
        uint256 weiAmount,
        uint256 tokenAmount
    );

    // Note: the payload of DidUpdateChannel contains the state that caused
    // the update, not the state post-update (ex, if the update contains a
    // deposit, the event's ``pendingDeposit`` field will be present and the
    // event's ``balance`` field will not have been updated to reflect that
    // balance).
    event DidUpdateChannel (
        address indexed user,
        uint256 senderIdx, // 0: hub, 1: user
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // [global, onchain]
        bytes32 threadRoot,
        uint256 threadCount
    );

    // Note: unlike the DidUpdateChannel event, the ``DidStartExitChannel``
    // event will contain the channel state after any state that has been
    // applied as part of startExitWithUpdate.
    event DidStartExitChannel (
        address indexed user,
        uint256 senderIdx, // 0: hub, 1: user
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[2] txCount, // [global, onchain]
        bytes32 threadRoot,
        uint256 threadCount
    );

    event DidEmptyChannel (
        address indexed user,
        uint256 senderIdx, // 0: hub, 1: user
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[2] txCount, // [global, onchain]
        bytes32 threadRoot,
        uint256 threadCount
    );

    event DidStartExitThread (
        address user,
        address indexed sender,
        address indexed receiver,
        uint256 threadId,
        address senderAddress, // either hub or user
        uint256[2] weiBalances, // [sender, receiver]
        uint256[2] tokenBalances, // [sender, receiver]
        uint256 txCount
    );

    event DidEmptyThread (
        address user,
        address indexed sender,
        address indexed receiver,
        uint256 threadId,
        address senderAddress, // can be anyone
        uint256[2] channelWeiBalances,
        uint256[2] channelTokenBalances,
        uint256[2] channelTxCount,
        bytes32 channelThreadRoot,
        uint256 channelThreadCount
    );

    event DidNukeThreads(
        address indexed user,
        address senderAddress, // can be anyone
        uint256 weiAmount, // amount of wei sent
        uint256 tokenAmount, // amount of tokens sent
        uint256[2] channelWeiBalances,
        uint256[2] channelTokenBalances,
        uint256[2] channelTxCount,
        bytes32 channelThreadRoot,
        uint256 channelThreadCount
    );

    enum ChannelStatus {
       Open,
       ChannelDispute,
       ThreadDispute
    }

    struct Channel {
        uint256[3] weiBalances; // [hub, user, total]
        uint256[3] tokenBalances; // [hub, user, total]
        uint256[2] txCount; // persisted onchain even when empty [global, pending]
        bytes32 threadRoot;
        uint256 threadCount;
        address exitInitiator;
        uint256 channelClosingTime;
        uint256 threadClosingTime;
        ChannelStatus status;
    }

    enum ThreadStatus {
        Open,
        Exiting,
        Settled
    }

    struct Thread {
        uint256[2] weiBalances; // [sender, receiver]
        uint256[2] tokenBalances; // [sender, receiver]
        uint256 txCount; // persisted onchain even when empty
        ThreadStatus status;
    }

    mapping(address => Channel) public channels;
    mapping(address => mapping(address => mapping(uint256 => Thread))) threads; // threads[sender][receiver][threadId]

    bool locked;

    modifier onlyHub() {
        require(msg.sender == hub);
        _;
    }

    modifier noReentrancy() {
        require(!locked, "Reentrant call.");
        locked = true;
        _;
        locked = false;
    }

    constructor(address _hub, uint256 _challengePeriod, address _tokenAddress) public {
        hub = _hub;
        challengePeriod = _challengePeriod;
        approvedToken = ERC20(_tokenAddress);
    }

    function hubContractWithdraw(uint256 weiAmount, uint256 tokenAmount) public noReentrancy onlyHub {
        require(
            getHubReserveWei() >= weiAmount,
            "hubContractWithdraw: Contract wei funds not sufficient to withdraw"
        );
        require(
            getHubReserveTokens() >= tokenAmount,
            "hubContractWithdraw: Contract token funds not sufficient to withdraw"
        );

        hub.transfer(weiAmount);
        require(
            approvedToken.transfer(hub, tokenAmount),
            "hubContractWithdraw: Token transfer failure"
        );

        emit DidHubContractWithdraw(weiAmount, tokenAmount);
    }

    function getHubReserveWei() public view returns (uint256) {
        return address(this).balance.sub(totalChannelWei);
    }

    function getHubReserveTokens() public view returns (uint256) {
        return approvedToken.balanceOf(address(this)).sub(totalChannelToken);
    }

    function hubAuthorizedUpdate(
        address user,
        address recipient,
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // [global, onchain] persisted onchain even when empty
        bytes32 threadRoot,
        uint256 threadCount,
        uint256 timeout,
        string sigUser
    ) public noReentrancy onlyHub {
        Channel storage channel = channels[user];

        _verifyAuthorizedUpdate(
            channel,
            txCount,
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            timeout,
            true
        );

        _verifySig(
            [user, recipient],
            weiBalances,
            tokenBalances,
            pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            txCount,
            threadRoot,
            threadCount,
            timeout,
            "", // skip hub sig verification
            sigUser,
            [false, true] // [checkHubSig?, checkUser] <- only need to check user
        );

        _updateChannelBalances(channel, weiBalances, tokenBalances, pendingWeiUpdates, pendingTokenUpdates);

        // transfer wei and token to recipient
        recipient.transfer(pendingWeiUpdates[3]);
        require(approvedToken.transfer(recipient, pendingTokenUpdates[3]), "user token withdrawal transfer failed");

        // update state variables
        channel.txCount = txCount;
        channel.threadRoot = threadRoot;
        channel.threadCount = threadCount;

        emit DidUpdateChannel(
            user,
            0, // senderIdx
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            txCount,
            threadRoot,
            threadCount
        );
    }

    function userAuthorizedUpdate(
        address recipient,
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // persisted onchain even when empty
        bytes32 threadRoot,
        uint256 threadCount,
        uint256 timeout,
        string sigHub
    ) public payable noReentrancy {
        require(msg.value == pendingWeiUpdates[2], "msg.value is not equal to pending user deposit");

        Channel storage channel = channels[msg.sender];

        _verifyAuthorizedUpdate(
            channel,
            txCount,
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            timeout,
            false
        );

        _verifySig(
            [msg.sender, recipient],
            weiBalances,
            tokenBalances,
            pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            txCount,
            threadRoot,
            threadCount,
            timeout,
            sigHub,
            "", // skip user sig verification
            [true, false] // [checkHubSig?, checkUser] <- only need to check hub
        );

        // transfer user token deposit to this contract
        require(approvedToken.transferFrom(msg.sender, address(this), pendingTokenUpdates[2]), "user token deposit failed");

        _updateChannelBalances(channel, weiBalances, tokenBalances, pendingWeiUpdates, pendingTokenUpdates);

        // transfer wei and token to recipient
        recipient.transfer(pendingWeiUpdates[3]);
        require(approvedToken.transfer(recipient, pendingTokenUpdates[3]), "user token withdrawal transfer failed");

        // update state variables
        channel.txCount = txCount;
        channel.threadRoot = threadRoot;
        channel.threadCount = threadCount;

        emit DidUpdateChannel(
            msg.sender,
            1, // senderIdx
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    /**********************
     * Unilateral Functions
     *********************/

    // start exit with onchain state
    function startExit(
        address user
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.Open, "channel must be open");

        require(msg.sender == hub || msg.sender == user, "exit initiator must be user or hub");

        channel.exitInitiator = msg.sender;
        channel.channelClosingTime = now.add(challengePeriod);
        channel.status = ChannelStatus.ChannelDispute;

        emit DidStartExitChannel(
            user,
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // start exit with offchain state
    function startExitWithUpdate(
        address[2] user, // [user, recipient]
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // [global, onchain] persisted onchain even when empty
        bytes32 threadRoot,
        uint256 threadCount,
        uint256 timeout,
        string sigHub,
        string sigUser
    ) public noReentrancy {
        Channel storage channel = channels[user[0]];
        require(channel.status == ChannelStatus.Open, "channel must be open");

        require(msg.sender == hub || msg.sender == user[0], "exit initiator must be user or hub");

        require(timeout == 0, "can't start exit with time-sensitive states");

        _verifySig(
            user,
            weiBalances,
            tokenBalances,
            pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            txCount,
            threadRoot,
            threadCount,
            timeout,
            sigHub,
            sigUser,
            [true, true] // [checkHubSig?, checkUser] <- check both sigs
        );

        require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
        require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

        // offchain wei/token balances do not exceed onchain total wei/token
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

        // pending onchain txs have been executed - force update offchain state to reflect this
        if (txCount[1] == channel.txCount[1]) {
            _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        // pending onchain txs have *not* been executed - revert pending deposits and withdrawals back into offchain balances
        } else { //txCount[1] > channel.txCount[1]
            _revertPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _revertPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        }

        // update state variables
        channel.txCount = txCount;
        channel.threadRoot = threadRoot;
        channel.threadCount = threadCount;

        channel.exitInitiator = msg.sender;
        channel.channelClosingTime = now.add(challengePeriod);
        channel.status = ChannelStatus.ChannelDispute;

        emit DidStartExitChannel(
            user[0],
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // party that didn't start exit can challenge and empty
    function emptyChannelWithChallenge(
        address[2] user,
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // persisted onchain even when empty
        bytes32 threadRoot,
        uint256 threadCount,
        uint256 timeout,
        string sigHub,
        string sigUser
    ) public noReentrancy {
        Channel storage channel = channels[user[0]];
        require(channel.status == ChannelStatus.ChannelDispute, "channel must be in dispute");
        require(now < channel.channelClosingTime, "channel closing time must not have passed");

        require(msg.sender != channel.exitInitiator, "challenger can not be exit initiator");
        require(msg.sender == hub || msg.sender == user[0], "challenger must be either user or hub");

        require(timeout == 0, "can't start exit with time-sensitive states");

        _verifySig(
            user,
            weiBalances,
            tokenBalances,
            pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
            txCount,
            threadRoot,
            threadCount,
            timeout,
            sigHub,
            sigUser,
            [true, true] // [checkHubSig?, checkUser] <- check both sigs
        );

        require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
        require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

        // offchain wei/token balances do not exceed onchain total wei/token
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

        // pending onchain txs have been executed - force update offchain state to reflect this
        if (txCount[1] == channel.txCount[1]) {
            _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        // pending onchain txs have *not* been executed - revert pending deposits and withdrawals back into offchain balances
        } else { //txCount[1] > channel.txCount[1]
            _revertPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _revertPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        }

        // deduct hub/user wei/tokens from total channel balances
        channel.weiBalances[2] = channel.weiBalances[2].sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
        channel.tokenBalances[2] = channel.tokenBalances[2].sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);

        // transfer hub wei balance from channel to reserves
        totalChannelWei = totalChannelWei.sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
        // transfer user wei balance to user
        user[0].transfer(channel.weiBalances[1]);
        channel.weiBalances[0] = 0;
        channel.weiBalances[1] = 0;

        // transfer hub token balance from channel to reserves
        totalChannelToken = totalChannelToken.sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);
        // transfer user token balance to user
        require(approvedToken.transfer(user[0], channel.tokenBalances[1]), "user token withdrawal transfer failed");
        channel.tokenBalances[0] = 0;
        channel.tokenBalances[1] = 0;

        // update state variables
        channel.txCount = txCount;
        channel.threadRoot = threadRoot;
        channel.threadCount = threadCount;

        if (channel.threadCount > 0) {
            channel.threadClosingTime = now.add(challengePeriod);
            channel.status = ChannelStatus.ThreadDispute;
        } else {
            channel.threadClosingTime = 0;
            channel.status = ChannelStatus.Open;
        }

        channel.exitInitiator = address(0x0);
        channel.channelClosingTime = 0;


        emit DidEmptyChannel(
            user[0],
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // after timer expires - anyone can call; even before timer expires, non-exit-initiating party can call
    function emptyChannel(
        address user
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ChannelDispute, "channel must be in dispute");

        require(
          channel.channelClosingTime < now ||
          msg.sender != channel.exitInitiator && (msg.sender == hub || msg.sender == user),
          "channel closing time must have passed or msg.sender must be non-exit-initiating party"
        );

        // deduct hub/user wei/tokens from total channel balances
        channel.weiBalances[2] = channel.weiBalances[2].sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
        channel.tokenBalances[2] = channel.tokenBalances[2].sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);

        // transfer hub wei balance from channel to reserves
        totalChannelWei = totalChannelWei.sub(channel.weiBalances[0]).sub(channel.weiBalances[1]);
        // transfer user wei balance to user
        user.transfer(channel.weiBalances[1]);
        channel.weiBalances[0] = 0;
        channel.weiBalances[1] = 0;

        // transfer hub token balance from channel to reserves
        totalChannelToken = totalChannelToken.sub(channel.tokenBalances[0]).sub(channel.tokenBalances[1]);
        // transfer user token balance to user
        require(approvedToken.transfer(user, channel.tokenBalances[1]), "user token withdrawal transfer failed");
        channel.tokenBalances[0] = 0;
        channel.tokenBalances[1] = 0;

        if (channel.threadCount > 0) {
            channel.threadClosingTime = now.add(challengePeriod);
            channel.status = ChannelStatus.ThreadDispute;
        } else {
            channel.threadClosingTime = 0;
            channel.status = ChannelStatus.Open;
        }

        channel.exitInitiator = address(0x0);
        channel.channelClosingTime = 0;

        emit DidEmptyChannel(
            user,
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // **********************
    // THREAD DISPUTE METHODS
    // **********************

    function exitSettledThread(
        address user,
        address sender,
        address receiver,
        uint256 threadId,
        uint256[2] weiBalances, // [sender, receiver] -> initial balances
        uint256[2] tokenBalances, // [sender, receiver] -> initial balances
        bytes proof,
        string sig
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
        require(now < channel.threadClosingTime, "channel thread closing time must not have passed");
        require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
        require(user == sender || user == receiver, "user must be thread sender or receiver");

        // Thread storage thread = channel.threads[sender][receiver];
        Thread storage thread = threads[sender][receiver][threadId];

        require(thread.status == ThreadStatus.Settled, "thread must be settled");

        // verify initial thread state
        _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

        require(thread.weiBalances[0].add(thread.weiBalances[1]) == weiBalances[0].add(weiBalances[1]), "updated wei balances must match sum of initial wei balances");
        require(thread.tokenBalances[0].add(thread.tokenBalances[1]) == tokenBalances[0].add(tokenBalances[1]), "updated token balances must match sum of initial token balances");

        require(thread.weiBalances[1] >= weiBalances[1] && thread.tokenBalances[1] >= tokenBalances[1], "receiver balances may never decrease");

        // deduct sender/receiver wei/tokens about to be emptied from the thread from the total channel balances
        channel.weiBalances[2] = channel.weiBalances[2].sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);
        channel.tokenBalances[2] = channel.tokenBalances[2].sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);

        // deduct wei balances from total channel wei and reset thread balances
        totalChannelWei = totalChannelWei.sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);

        // if user is receiver, send them receiver wei balance
        if (user == receiver) {
            user.transfer(thread.weiBalances[1]);
        // if user is sender, send them remainining sender wei balance
        } else if (user == sender) {
            user.transfer(thread.weiBalances[0]);
        }

        // deduct token balances from channel total balances and reset thread balances
        totalChannelToken = totalChannelToken.sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);

        // if user is receiver, send them receiver token balance
        if (user == receiver) {
            require(approvedToken.transfer(user, thread.tokenBalances[1]), "user [receiver] token withdrawal transfer failed");
        // if user is sender, send them remainining sender token balance
        } else if (user == sender) {
            require(approvedToken.transfer(user, thread.tokenBalances[0]), "user [sender] token withdrawal transfer failed");
        }

        // decrement the channel threadCount
        channel.threadCount = channel.threadCount.sub(1);

        // if this is the last thread being emptied, re-open the channel
        if (channel.threadCount == 0) {
            channel.threadRoot = bytes32(0x0);
            channel.threadClosingTime = 0;
            channel.status = ChannelStatus.Open;
        }

        emit DidEmptyThread(
            user,
            sender,
            receiver,
            threadId,
            msg.sender,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // either party starts exit with initial state
    function startExitThread(
        address user,
        address sender,
        address receiver,
        uint256 threadId,
        uint256[2] weiBalances, // [sender, receiver]
        uint256[2] tokenBalances, // [sender, receiver]
        bytes proof,
        string sig
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
        require(now < channel.threadClosingTime, "channel thread closing time must not have passed");
        require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
        require(user == sender || user == receiver, "user must be thread sender or receiver");

        Thread storage thread = threads[sender][receiver][threadId];

        require(thread.status == ThreadStatus.Open, "thread must be open");

        _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

        thread.weiBalances = weiBalances;
        thread.tokenBalances = tokenBalances;
        thread.status = ThreadStatus.Exiting;

        emit DidStartExitThread(
            user,
            sender,
            receiver,
            threadId,
            msg.sender,
            thread.weiBalances,
            thread.tokenBalances,
            thread.txCount
        );
    }

    // either party starts exit with offchain state
    function startExitThreadWithUpdate(
        address user,
        address[2] threadMembers, //[sender, receiver]
        uint256 threadId,
        uint256[2] weiBalances, // [sender, receiver]
        uint256[2] tokenBalances, // [sender, receiver]
        bytes proof,
        string sig,
        uint256[2] updatedWeiBalances, // [sender, receiver]
        uint256[2] updatedTokenBalances, // [sender, receiver]
        uint256 updatedTxCount,
        string updateSig
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
        require(now < channel.threadClosingTime, "channel thread closing time must not have passed");
        require(msg.sender == hub || msg.sender == user, "thread exit initiator must be user or hub");
        require(user == threadMembers[0] || user == threadMembers[1], "user must be thread sender or receiver");

        Thread storage thread = threads[threadMembers[0]][threadMembers[1]][threadId];
        require(thread.status == ThreadStatus.Open, "thread must be open");

        _verifyThread(threadMembers[0], threadMembers[1], threadId, weiBalances, tokenBalances, 0, proof, sig, channel.threadRoot);

        // *********************
        // PROCESS THREAD UPDATE
        // *********************

        require(updatedTxCount > 0, "updated thread txCount must be higher than 0");
        require(updatedWeiBalances[0].add(updatedWeiBalances[1]) == weiBalances[0].add(weiBalances[1]), "updated wei balances must match sum of initial wei balances");
        require(updatedTokenBalances[0].add(updatedTokenBalances[1]) == tokenBalances[0].add(tokenBalances[1]), "updated token balances must match sum of initial token balances");

        require(
          updatedWeiBalances[1] >  weiBalances[1] && updatedTokenBalances[1] >= tokenBalances[1] ||
          updatedWeiBalances[1] >= weiBalances[1] && updatedTokenBalances[1] >  tokenBalances[1],
          "receiver balances may never decrease and either wei or token balance must strictly increase"
        );

        // Note: explicitly set threadRoot == 0x0 because then it doesn't get checked by _isContained (updated state is not part of root)
        _verifyThread(threadMembers[0], threadMembers[1], threadId, updatedWeiBalances, updatedTokenBalances, updatedTxCount, "", updateSig, bytes32(0x0));

        thread.weiBalances = updatedWeiBalances;
        thread.tokenBalances = updatedTokenBalances;
        thread.txCount = updatedTxCount;
        thread.status = ThreadStatus.Exiting;

        emit DidStartExitThread(
            user,
            threadMembers[0],
            threadMembers[1],
            threadId,
            msg.sender == hub ? 0 : 1,
            thread.weiBalances,
            thread.tokenBalances,
            thread.txCount
        );
    }

    // non-sender can empty anytime with a state update after startExitThread/WithUpdate is called
    function fastEmptyThread(
        address user,
        address sender,
        address receiver,
        uint256 threadId,
        uint256[2] weiBalances, // updated weiBalances
        uint256[2] tokenBalances, // updated tokenBalances
        uint256 txCount,
        string sig
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute phase");
        require(now < channel.threadClosingTime, "channel thread closing time must not have passed");
        require((msg.sender == hub && sender == user) || (msg.sender == user && receiver == user), "only hub or user, as the non-sender, can call this function");

        Thread storage thread = threads[sender][receiver][threadId];
        require(thread.status == ThreadStatus.Exiting, "thread must be exiting");

        // assumes that the non-sender has a later thread state than what was being proposed when the thread exit started
        require(txCount > thread.txCount, "thread txCount must be higher than the current thread txCount");
        require(weiBalances[0].add(weiBalances[1]) == thread.weiBalances[0].add(thread.weiBalances[1]), "updated wei balances must match sum of thread wei balances");
        require(tokenBalances[0].add(tokenBalances[1]) == thread.tokenBalances[0].add(thread.tokenBalances[1]), "updated token balances must match sum of thread token balances");

        require(
          weiBalances[1] >  thread.weiBalances[1] && tokenBalances[1] >= thread.tokenBalances[1] ||
          weiBalances[1] >= thread.weiBalances[1] && tokenBalances[1] >  thread.tokenBalances[1],
          "receiver balances may never decrease and either wei or token balance must strictly increase"
        );

        // Note: explicitly set threadRoot == 0x0 because then it doesn't get checked by _isContained (updated state is not part of root)
        _verifyThread(sender, receiver, threadId, weiBalances, tokenBalances, txCount, "", sig, bytes32(0x0));

        // deduct sender/receiver wei/tokens about to be emptied from the thread from the total channel balances
        channel.weiBalances[2] = channel.weiBalances[2].sub(weiBalances[0]).sub(weiBalances[1]);
        channel.tokenBalances[2] = channel.tokenBalances[2].sub(tokenBalances[0]).sub(tokenBalances[1]);

        // deduct wei balances from total channel wei and reset thread balances
        totalChannelWei = totalChannelWei.sub(weiBalances[0]).sub(weiBalances[1]);
        thread.weiBalances = weiBalances;

        // if user is receiver, send them receiver wei balance
        if (user == receiver) {
            user.transfer(weiBalances[1]);
        // if user is sender, send them remaining sender wei balance
        } else if (user == sender) {
            user.transfer(weiBalances[0]);
        }

        // deduct token balances from channel total balances and reset thread balances
        totalChannelToken = totalChannelToken.sub(tokenBalances[0]).sub(tokenBalances[1]);
        thread.tokenBalances = tokenBalances;

        // if user is receiver, send them receiver token balance
        if (user == receiver) {
            require(approvedToken.transfer(user, tokenBalances[1]), "user [receiver] token withdrawal transfer failed");
        // if user is sender, send them remaining sender token balance
        } else if (user == sender) {
            require(approvedToken.transfer(user, tokenBalances[0]), "user [sender] token withdrawal transfer failed");
        }

        thread.txCount = txCount;
        thread.status = ThreadStatus.Settled;

        // decrement the channel threadCount
        channel.threadCount = channel.threadCount.sub(1);

        // if this is the last thread being emptied, re-open the channel
        if (channel.threadCount == 0) {
            channel.threadRoot = bytes32(0x0);
            channel.threadClosingTime = 0;
            channel.status = ChannelStatus.Open;
        }

        emit DidEmptyThread(
            user,
            sender,
            receiver,
            threadId,
            msg.sender,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // after timer expires, anyone can empty with onchain state
    function emptyThread(
        address user,
        address sender,
        address receiver,
        uint256 threadId
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute");
        require(channel.threadClosingTime < now, "thread closing time must have passed");

        Thread storage thread = threads[sender][receiver][threadId];
        require(thread.status == ThreadStatus.Exiting, "thread must be exiting");

        // deduct sender/receiver wei/tokens about to be emptied from the thread from the total channel balances
        channel.weiBalances[2] = channel.weiBalances[2].sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);
        channel.tokenBalances[2] = channel.tokenBalances[2].sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);

        // deduct wei balances from total channel wei and reset thread balances
        totalChannelWei = totalChannelWei.sub(thread.weiBalances[0]).sub(thread.weiBalances[1]);
        // transfer wei to user if they are receiver (otherwise gets added to reserves implicitly)
        // if user is receiver, send them receiver wei balance
        if (user == receiver) {
            user.transfer(thread.weiBalances[1]);
        // if user is sender, send them remaining sender wei balance
        } else if (user == sender) {
            user.transfer(thread.weiBalances[0]);
        }

        // deduct token balances from channel total balances and reset thread balances
        totalChannelToken = totalChannelToken.sub(thread.tokenBalances[0]).sub(thread.tokenBalances[1]);
        // if user is receiver, send them receiver token balance
        if (user == receiver) {
            require(approvedToken.transfer(user, thread.tokenBalances[1]), "user [receiver] token withdrawal transfer failed");
        // if user is sender, send them remaining sender token balance
        } else if (user == sender) {
            require(approvedToken.transfer(user, thread.tokenBalances[0]), "user [sender] token withdrawal transfer failed");
        }

        thread.status = ThreadStatus.Settled;

        // decrement the channel threadCount
        channel.threadCount = channel.threadCount.sub(1);

        // if this is the last thread being emptied, re-open the channel
        if (channel.threadCount == 0) {
            channel.threadRoot = bytes32(0x0);
            channel.threadClosingTime = 0;
            channel.status = ChannelStatus.Open;
        }

        emit DidEmptyThread(
            user,
            sender,
            receiver,
            threadId,
            msg.sender,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    // anyone can call to re-open an account stuck in threadDispute after 10x challengePeriods
    function nukeThreads(
        address user
    ) public noReentrancy {
        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ThreadDispute, "channel must be in thread dispute");
        require(channel.threadClosingTime.add(challengePeriod.mul(10)) < now, "thread closing time must have passed by 10 challenge periods");

        // transfer any remaining channel wei to user
        totalChannelWei = totalChannelWei.sub(channel.weiBalances[2]);
        user.transfer(channel.weiBalances[2]);
        uint256 weiAmount = channel.weiBalances[2];
        channel.weiBalances[2] = 0;

        // transfer any remaining channel tokens to user
        totalChannelToken = totalChannelToken.sub(channel.tokenBalances[2]);
        require(approvedToken.transfer(user, channel.tokenBalances[2]), "user token withdrawal transfer failed");
        uint256 tokenAmount = channel.tokenBalances[2];
        channel.tokenBalances[2] = 0;

        // reset channel params
        channel.threadCount = 0;
        channel.threadRoot = bytes32(0x0);
        channel.threadClosingTime = 0;
        channel.status = ChannelStatus.Open;

        emit DidNukeThreads(
            user,
            msg.sender,
            weiAmount,
            tokenAmount,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount,
            channel.threadRoot,
            channel.threadCount
        );
    }

    function() external payable {}

    // ******************
    // INTERNAL FUNCTIONS
    // ******************

    function _verifyAuthorizedUpdate(
        Channel storage channel,
        uint256[2] txCount,
        uint256[2] weiBalances,
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256 timeout,
        bool isHub
    ) internal view {
        require(channel.status == ChannelStatus.Open, "channel must be open");

        // Usage:
        // 1. exchange operations to protect user from exchange rate fluctuations
        // 2. protects hub against user delaying forever
        require(timeout == 0 || now < timeout, "the timeout must be zero or not have passed");

        require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
        require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

        // offchain wei/token balances do not exceed onchain total wei/token
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[2], "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[2], "tokens must be conserved");

        // hub has enough reserves for wei/token deposits for both the user and itself (if isHub, user deposit comes from hub)
        if (isHub) {
            require(pendingWeiUpdates[0].add(pendingWeiUpdates[2]) <= getHubReserveWei(), "insufficient reserve wei for deposits");
            require(pendingTokenUpdates[0].add(pendingTokenUpdates[2]) <= getHubReserveTokens(), "insufficient reserve tokens for deposits");
        // hub has enough reserves for only its own wei/token deposits
        } else {
            require(pendingWeiUpdates[0] <= getHubReserveWei(), "insufficient reserve wei for deposits");
            require(pendingTokenUpdates[0] <= getHubReserveTokens(), "insufficient reserve tokens for deposits");
        }

        // wei is conserved - the current total channel wei + both deposits > final balances + both withdrawals
        require(channel.weiBalances[2].add(pendingWeiUpdates[0]).add(pendingWeiUpdates[2]) >=
                weiBalances[0].add(weiBalances[1]).add(pendingWeiUpdates[1]).add(pendingWeiUpdates[3]), "insufficient wei");

        // token is conserved - the current total channel token + both deposits > final balances + both withdrawals
        require(channel.tokenBalances[2].add(pendingTokenUpdates[0]).add(pendingTokenUpdates[2]) >=
                tokenBalances[0].add(tokenBalances[1]).add(pendingTokenUpdates[1]).add(pendingTokenUpdates[3]), "insufficient token");
    }

    function _applyPendingUpdates(
        uint256[3] storage channelBalances,
        uint256[2] balances,
        uint256[4] pendingUpdates
    ) internal {
        // update hub balance
        // 1: { weiBalances: [100, 100] }
        // 1: { weiBalances: [100, 100], pendingWeiUpdates: [0, 0, 100, 50] } <- deposit > withdrawal, don't update offchain [COMMITTED ONCHAIN]
        // 1: { weiBalances: [110, 90], pendingWeiUpdates: [0, 0, 100, 50] } <- user pays hub [OFFCHAIN UPDATE]
        // 1: { weiBalances: [110, 140] <- final (apply pending updates)
        // If the deposit is greater than the withdrawal, add the net of deposit minus withdrawal to the balances.
        // Assumes the net has *not yet* been added to the balances.
        if (pendingUpdates[0] > pendingUpdates[1]) {
            channelBalances[0] = balances[0].add(pendingUpdates[0].sub(pendingUpdates[1]));
        // 2: { weiBalances: [100, 100] }
        // 2: { weiBalances: [100, 50], pendingWeiUpdates: [0, 0, 50, 100] } <- deposit < withdrawal, add delta offchain [COMMITTED ONCHAIN]
        // 2: { weiBalances: [110, 40], pendingWeiUpdates: [0, 0, 50, 100] } <- user pays hub [OFFCHAIN UPDATE]
        // 2: { weiBalances: [110, 40] <- final (discard pending updates)
        // Otherwise, if the deposit is less than or equal to the withdrawal,
        // Assumes the net has *already* been added to the balances.
        } else {
            channelBalances[0] = balances[0];
        }

        // update user balance
        // If the deposit is greater than the withdrawal, add the net of deposit minus withdrawal to the balances.
        // Assumes the net has *not yet* been added to the balances.
        if (pendingUpdates[2] > pendingUpdates[3]) {
            channelBalances[1] = balances[1].add(pendingUpdates[2].sub(pendingUpdates[3]));

        // 0: { weiBalances: [100, 100] }
        // 0: { weiBalances: [100, 50], pendingWeiUpdates: [0, 0, 0, 50] } <- deposit < withdrawal, add delta offchain [COMMITTED ONCHAIN]
        // 0: { weiBalances: [110, 50], pendingWeiUpdates: [0, 0, 0, 50] } <- user pays hub [OFFCHAIN UPDATE]
        // 0: { weiBalances: [110, 40] <- final (discard pending updates)
        // Otherwise, if the deposit is less than or equal to the withdrawal,
        // Assumes the net has *already* been added to the balances.
        } else {
            channelBalances[1] = balances[1];
        }
    }

    function _revertPendingUpdates(
        uint256[3] storage channelBalances,
        uint256[2] balances,
        uint256[4] pendingUpdates
    ) internal {
        // 1: { weiBalances: [100, 100] }
        // 1: { weiBalances: [100, 100], pendingWeiUpdates: [0, 0, 100, 50] } <- deposit > withdrawal, don't update offchain [NOT COMMITTED ONCHAIN]
        // 1: { weiBalances: [110, 90], pendingWeiUpdates: [0, 0, 100, 50] } <- user pays hub [OFFCHAIN UPDATE]
        // 1: { weiBalances: [110, 90] <- final (discard pending updates)
        // If the pending update has NOT been executed AND deposits > withdrawals, offchain state was NOT updated with delta, and is thus correct
        if (pendingUpdates[0] > pendingUpdates[1]) {
            channelBalances[0] = balances[0];

        // 2: { weiBalances: [100, 100] }
        // 2: { weiBalances: [100, 50], pendingWeiUpdates: [0, 0, 50, 100] } <- deposit < withdrawal, add delta offchain [NOT COMMITTED ONCHAIN]
        // 2: { weiBalances: [110, 40], pendingWeiUpdates: [0, 0, 50, 100] } <- user pays hub [OFFCHAIN UPDATE]
        // 2: { weiBalances: [110, 90] <- final (revert pending updates)
        // If the pending update has NOT been executed AND deposits < withdrawals, offchain state should have been updated with delta, and must be reverted
        } else {
            channelBalances[0] = balances[0].add(pendingUpdates[1].sub(pendingUpdates[0])); // <- add withdrawal, sub deposit (opposite order as _applyPendingUpdates)
        }

        // If the pending update has NOT been executed AND deposits > withdrawals, offchain state was NOT updated with delta, and is thus correct
        if (pendingUpdates[2] > pendingUpdates[3]) {
            channelBalances[1] = balances[1];

        // If the pending update has NOT been executed AND deposits > withdrawals, offchain state should have been updated with delta, and must be reverted
        } else {
            channelBalances[1] = balances[1].add(pendingUpdates[3].sub(pendingUpdates[2])); // <- add withdrawal, sub deposit (opposite order as _applyPendingUpdates)
        }
    }

    function _updateChannelBalances(
        Channel storage channel,
        uint256[2] weiBalances,
        uint256[2] tokenBalances,
        uint256[4] pendingWeiUpdates,
        uint256[4] pendingTokenUpdates
    ) internal {
        _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
        _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);

        totalChannelWei = totalChannelWei.add(pendingWeiUpdates[0]).add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[1]).sub(pendingWeiUpdates[3]);
        totalChannelToken = totalChannelToken.add(pendingTokenUpdates[0]).add(pendingTokenUpdates[2]).sub(pendingTokenUpdates[1]).sub(pendingTokenUpdates[3]);

        // update channel total balances
        channel.weiBalances[2] = channel.weiBalances[2].add(pendingWeiUpdates[0]).add(pendingWeiUpdates[2]).sub(pendingWeiUpdates[1]).sub(pendingWeiUpdates[3]);
        channel.tokenBalances[2] = channel.tokenBalances[2].add(pendingTokenUpdates[0]).add(pendingTokenUpdates[2]).sub(pendingTokenUpdates[1]).sub(pendingTokenUpdates[3]);
    }

    function _verifySig (
        address[2] user, // [user, recipient]
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // [global, onchain] persisted onchain even when empty
        bytes32 threadRoot,
        uint256 threadCount,
        uint256 timeout,
        string sigHub,
        string sigUser,
        bool[2] checks // [checkHubSig?, checkUserSig?]
    ) internal view {
        require(user[0] != hub, "user can not be hub");

        // prepare state hash to check hub sig
        bytes32 state = keccak256(
            abi.encodePacked(
                address(this),
                user, // [user, recipient]
                weiBalances, // [hub, user]
                tokenBalances, // [hub, user]
                pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
                pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
                txCount, // persisted onchain even when empty
                threadRoot,
                threadCount,
                timeout
            )
        );

        if (checks[0]) {
            require(hub == ECTools.recoverSigner(state, sigHub), "hub signature invalid");
        }

        if (checks[1]) {
            require(user[0] == ECTools.recoverSigner(state, sigUser), "user signature invalid");
        }
    }

    function _verifyThread(
        address sender,
        address receiver,
        uint256 threadId,
        uint256[2] weiBalances,
        uint256[2] tokenBalances,
        uint256 txCount,
        bytes proof,
        string sig,
        bytes32 threadRoot
    ) internal view {
        require(sender != receiver, "sender can not be receiver");
        require(sender != hub && receiver != hub, "hub can not be sender or receiver");

        bytes32 state = keccak256(
            abi.encodePacked(
                address(this),
                sender,
                receiver,
                threadId,
                weiBalances, // [sender, receiver]
                tokenBalances, // [sender, receiver]
                txCount // persisted onchain even when empty
            )
        );
        require(ECTools.isSignedBy(state, sig, sender), "signature invalid");

        if (threadRoot != bytes32(0x0)) {
            require(_isContained(state, proof, threadRoot), "initial thread state is not contained in threadRoot");
        }
    }

    function _isContained(bytes32 _hash, bytes _proof, bytes32 _root) internal pure returns (bool) {
        bytes32 cursor = _hash;
        bytes32 proofElem;

        for (uint256 i = 64; i <= _proof.length; i += 32) {
            assembly { proofElem := mload(add(_proof, i)) }

            if (cursor < proofElem) {
                cursor = keccak256(abi.encodePacked(cursor, proofElem));
            } else {
                cursor = keccak256(abi.encodePacked(proofElem, cursor));
            }
        }

        return cursor == _root;
    }
}
