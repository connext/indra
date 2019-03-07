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
        uint256[2] txCount // [global, onchain]
    );

    // Note: unlike the DidUpdateChannel event, the ``DidStartExitChannel``
    // event will contain the channel state after any state that has been
    // applied as part of startExitWithUpdate.
    event DidStartExitChannel (
        address indexed user,
        uint256 senderIdx, // 0: hub, 1: user
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[2] txCount // [global, onchain]
    );

    event DidEmptyChannel (
        address indexed user,
        uint256 senderIdx, // 0: hub, 1: user
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[2] txCount // [global, onchain]
    );

    enum ChannelStatus {
       Open,
       ChannelDispute
    }

    struct Channel {
        uint256[2] weiBalances; // [hub, user]
        uint256[2] tokenBalances; // [hub, user]
        uint256[2] txCount; // persisted onchain even when empty [global, pending]
        address exitInitiator;
        uint256 channelClosingTime;
        ChannelStatus status;
    }

    mapping(address => Channel) public channels;

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

        emit DidUpdateChannel(
            user,
            0, // senderIdx
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            txCount
        );
    }

    function userAuthorizedUpdate(
        address recipient,
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // persisted onchain even when empty
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

        emit DidUpdateChannel(
            msg.sender,
            1, // senderIdx
            weiBalances,
            tokenBalances,
            pendingWeiUpdates,
            pendingTokenUpdates,
            channel.txCount
        );
    }

    /**********************
     * Unilateral Functions
     *********************/

    // start exit with onchain state
    function startExit(
        address user
    ) public noReentrancy {
        require(user != hub, "user can not be hub");
        require(user != address(this), "user can not be channel manager");

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
            channel.txCount
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
            timeout,
            sigHub,
            sigUser,
            [true, true] // [checkHubSig?, checkUser] <- check both sigs
        );

        require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
        require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

        // offchain wei/token balances do not exceed onchain total wei/token
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[0].add(channel.weiBalances[1]), "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[0].add(channel.tokenBalances[1]), "tokens must be conserved");

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

        channel.exitInitiator = msg.sender;
        channel.channelClosingTime = now.add(challengePeriod);
        channel.status = ChannelStatus.ChannelDispute;

        emit DidStartExitChannel(
            user[0],
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount
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
            timeout,
            sigHub,
            sigUser,
            [true, true] // [checkHubSig?, checkUser] <- check both sigs
        );

        require(txCount[0] > channel.txCount[0], "global txCount must be higher than the current global txCount");
        require(txCount[1] >= channel.txCount[1], "onchain txCount must be higher or equal to the current onchain txCount");

        // offchain wei/token balances do not exceed onchain total wei/token
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[0].add(channel.weiBalances[1]), "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[0].add(channel.tokenBalances[1]), "tokens must be conserved");

        // pending onchain txs have been executed - force update offchain state to reflect this
        if (txCount[1] == channel.txCount[1]) {
            _applyPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _applyPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        // pending onchain txs have *not* been executed - revert pending deposits and withdrawals back into offchain balances
        } else { //txCount[1] > channel.txCount[1]
            _revertPendingUpdates(channel.weiBalances, weiBalances, pendingWeiUpdates);
            _revertPendingUpdates(channel.tokenBalances, tokenBalances, pendingTokenUpdates);
        }

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
        channel.channelClosingTime = 0;
        channel.status = ChannelStatus.Open;
        channel.exitInitiator = address(0x0);

        emit DidEmptyChannel(
            user[0],
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount
        );
    }

    // after timer expires - anyone can call; even before timer expires, non-exit-initiating party can call
    function emptyChannel(
        address user
    ) public noReentrancy {
        require(user != hub, "user can not be hub");
        require(user != address(this), "user can not be channel manager");

        Channel storage channel = channels[user];
        require(channel.status == ChannelStatus.ChannelDispute, "channel must be in dispute");

        require(
          channel.channelClosingTime < now ||
          msg.sender != channel.exitInitiator && (msg.sender == hub || msg.sender == user),
          "channel closing time must have passed or msg.sender must be non-exit-initiating party"
        );

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

        channel.channelClosingTime = 0;
        channel.status = ChannelStatus.Open;
        channel.exitInitiator = address(0x0);

        emit DidEmptyChannel(
            user,
            msg.sender == hub ? 0 : 1,
            [channel.weiBalances[0], channel.weiBalances[1]],
            [channel.tokenBalances[0], channel.tokenBalances[1]],
            channel.txCount
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
        require(weiBalances[0].add(weiBalances[1]) <= channel.weiBalances[0].add(channel.weiBalances[1]), "wei must be conserved");
        require(tokenBalances[0].add(tokenBalances[1]) <= channel.tokenBalances[0].add(channel.tokenBalances[1]), "tokens must be conserved");

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
        uint256[2] storage channelBalances,
        uint256[2] balances,
        uint256[4] pendingUpdates
    ) internal {
        // update hub balance
        // If the deposit is greater than the withdrawal, add the net of deposit minus withdrawal to the balances.
        // Assumes the net has *not yet* been added to the balances.
        if (pendingUpdates[0] > pendingUpdates[1]) {
            channelBalances[0] = balances[0].add(pendingUpdates[0].sub(pendingUpdates[1]));
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
        // Otherwise, if the deposit is less than or equal to the withdrawal,
        // Assumes the net has *already* been added to the balances.
        } else {
            channelBalances[1] = balances[1];
        }
    }

    function _revertPendingUpdates(
        uint256[2] storage channelBalances,
        uint256[2] balances,
        uint256[4] pendingUpdates
    ) internal {
        // If the pending update has NOT been executed AND deposits > withdrawals, offchain state was NOT updated with delta, and is thus correct
        if (pendingUpdates[0] > pendingUpdates[1]) {
            channelBalances[0] = balances[0];
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
    }

    function _verifySig (
        address[2] user, // [user, recipient]
        uint256[2] weiBalances, // [hub, user]
        uint256[2] tokenBalances, // [hub, user]
        uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
        uint256[2] txCount, // [global, onchain] persisted onchain even when empty
        uint256 timeout,
        string sigHub,
        string sigUser,
        bool[2] checks // [checkHubSig?, checkUserSig?]
    ) internal view {
        require(user[0] != hub, "user can not be hub");
        require(user[0] != address(this), "user can not be channel manager");

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
}
