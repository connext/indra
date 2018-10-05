pragma solidity ^0.4.23;

import "./lib/ECTools.sol";
import "./lib/token/HumanStandardToken.sol";

/// @title Set Virtual Channels - A layer2 hub and spoke payment network 
/// @author Nathan Ginnever

contract ChannelManager {

    string public constant NAME = "ChannelManager";
    string public constant VERSION = "0.0.1";

    uint256 public numChannels = 0;

    event DidChannelOpen (
        bytes32 indexed channelId,
        address indexed partyA,
        address indexed partyI,
        uint256 ethBalanceA,
        address token,
        uint256 tokenBalanceA,
        uint256 openTimeout
    );

    event DidChannelJoin (
        bytes32 indexed channelId,
        uint256 ethBalanceI,
        uint256 tokenBalanceI
    );

    event DidChannelDeposit (
        bytes32 indexed channelId,
        address indexed recipient,
        uint256 deposit,
        bool isToken
    );

    event DidChannelUpdateState (
        bytes32 indexed channelId, 
        uint256 sequence, 
        uint256 numOpenThread, 
        uint256 ethBalanceA,
        uint256 tokenBalanceA,
        uint256 ethBalanceI,
        uint256 tokenBalanceI,
        bytes32 threadRoot,
        uint256 updateChannelTimeout
    );

    event DidChannelClose (
        bytes32 indexed channelId,
        uint256 sequence,
        uint256 ethBalanceA,
        uint256 tokenBalanceA,
        uint256 ethBalanceI,
        uint256 tokenBalanceI
    );

    event DidThreadInit (
        bytes32 indexed lcId, 
        bytes32 indexed vcId, 
        bytes proof, 
        uint256 sequence, 
        address partyA, 
        address partyB, 
        uint256 balanceA, 
        uint256 balanceB 
    );

    event DidThreadSettle (
        bytes32 indexed lcId, 
        bytes32 indexed vcId,
        uint256 updateSeq, 
        uint256 updateBalA, 
        uint256 updateBalB,
        address challenger,
        uint256 updateThreadTimeout
    );

    event DidThreadClose(
        bytes32 indexed lcId, 
        bytes32 indexed vcId, 
        uint256 balanceA, 
        uint256 balanceB
    );

    struct Channel {
        //TODO: figure out if it's better just to split arrays by balances/deposits instead of eth/erc20
        address[2] partyAddresses; // 0: partyA 1: partyI
        uint256[4] ethBalances; // 0: balanceA 1:balanceI 2:depositedA 3:depositedI
        uint256[4] erc20Balances; // 0: balanceA 1:balanceI 2:depositedA 3:depositedI
        uint256[2] initialDeposit; // 0: eth 1: tokens
        uint256 sequence;
        uint256 confirmTime;
        bytes32 threadRootHash;
        uint256 openTimeout;
        uint256 updateChannelTimeout; // when update channel times out
        bool isOpen; // true when both parties have joined
        bool isUpdateChannelSettling;
        uint256 numOpenThread;
        HumanStandardToken token;
    }

    // thread state
    struct Thread {
        bool isClose;
        bool isInSettlementState;
        uint256 sequence;
        address challenger; // Initiator of challenge
        uint256 updateThreadTimeout; // when update thread times out
        // channel state
        address partyA; // thread participant A
        address partyB; // thread participant B
        address partyI; // channel hub
        uint256[2] ethBalances;
        uint256[2] erc20Balances;
        uint256[2] bond;
        HumanStandardToken token;
    }

    mapping(bytes32 => Thread) public Threads;
    mapping(bytes32 => Channel) public Channels;

    function createChannel(
        bytes32 _channelId,
        address _partyI,
        uint256 _confirmTime,
        address _token,
        uint256[2] _balances // [eth, token]
    ) 
        public
        payable 
    {
        require(Channels[_channelId].partyAddresses[0] == address(0), "Channel has already been created.");
        require(_partyI != 0x0, "No partyI address provided to channel creation");
        require(_balances[0] >= 0 && _balances[1] >= 0, "Balances cannot be negative");
        // Set initial channel state
        // Alice must execute this and we assume the initial state 
        // to be signed from this requirement
        // Alternative is to check a sig as in joinChannel
        Channels[_channelId].partyAddresses[0] = msg.sender;
        Channels[_channelId].partyAddresses[1] = _partyI;

        if(_balances[0] != 0) {
            require(msg.value == _balances[0], "Eth balance does not match sent value");
            Channels[_channelId].ethBalances[0] = msg.value;
        } 
        if(_balances[1] != 0) {
            Channels[_channelId].token = HumanStandardToken(_token);
            require(Channels[_channelId].token.transferFrom(msg.sender, this, _balances[1]),"CreateChannel: token transfer failure");
            Channels[_channelId].erc20Balances[0] = _balances[1];
        }

        Channels[_channelId].sequence = 0;
        Channels[_channelId].confirmTime = _confirmTime;
        // is close flag, channel state sequence, number open vc, thread root hash, partyA... 
        //Channels[_channelId].stateHash = keccak256(uint256(0), uint256(0), uint256(0), bytes32(0x0), bytes32(msg.sender), bytes32(_partyI), balanceA, balanceI);
        Channels[_channelId].openTimeout = now + _confirmTime;
        Channels[_channelId].initialDeposit = _balances;

        emit DidChannelOpen(_channelId, msg.sender, _partyI, _balances[0], _token, _balances[1], Channels[_channelId].openTimeout);
    }

    function channelOpenTimeout(bytes32 _channelId) public {
        require(msg.sender == Channels[_channelId].partyAddresses[0] && Channels[_channelId].isOpen == false);
        require(now > Channels[_channelId].openTimeout);

        if(Channels[_channelId].initialDeposit[0] != 0) {
            //TODO: what happens if eth transfer fails?
            Channels[_channelId].partyAddresses[0].transfer(Channels[_channelId].ethBalances[0]);
        } 
        if(Channels[_channelId].initialDeposit[1] != 0) {
            require(Channels[_channelId].token.transfer(Channels[_channelId].partyAddresses[0], Channels[_channelId].erc20Balances[0]),"CreateChannel: token transfer failure");
        }

        emit DidChannelClose(_channelId, 0, Channels[_channelId].ethBalances[0], Channels[_channelId].erc20Balances[0], 0, 0);

        // only safe to delete since no action was taken on this channel
        delete Channels[_channelId];
    }

    function joinChannel(bytes32 _channelId, uint256[2] _balances) public payable {
        // require the channel is not open yet
        require(Channels[_channelId].isOpen == false);
        require(msg.sender == Channels[_channelId].partyAddresses[1]);
        //TODO check if balances are negative?

        if(_balances[0] != 0) {
            require(msg.value == _balances[0], "state balance does not match sent value");
            Channels[_channelId].ethBalances[1] = msg.value;
        } 
        if(_balances[1] != 0) {
            require(Channels[_channelId].token.transferFrom(msg.sender, this, _balances[1]),"joinChannel: token transfer failure");
            Channels[_channelId].erc20Balances[1] = _balances[1];          
        }

        Channels[_channelId].initialDeposit[0]+=_balances[0];
        Channels[_channelId].initialDeposit[1]+=_balances[1];
        // no longer allow joining functions to be called
        Channels[_channelId].isOpen = true;
        numChannels++;

        emit DidChannelJoin(_channelId, _balances[0], _balances[1]);
    }


    // additive updates of monetary state
    // TODO check this for attack vectors
    function deposit(bytes32 _channelId, address recipient, uint256 _balance, bool isToken) public payable {
        require(Channels[_channelId].isOpen == true, "Tried adding funds to a closed channel");
        require(recipient == Channels[_channelId].partyAddresses[0] || recipient == Channels[_channelId].partyAddresses[1]);

        //if(Channels[_channelId].token)

        if (Channels[_channelId].partyAddresses[0] == recipient) {
            if(isToken) {
                require(Channels[_channelId].token.transferFrom(msg.sender, this, _balance),"deposit: token transfer failure");
                Channels[_channelId].erc20Balances[2] += _balance;
            } else {
                require(msg.value == _balance, "state balance does not match sent value");
                Channels[_channelId].ethBalances[2] += msg.value;
            }
        }

        if (Channels[_channelId].partyAddresses[1] == recipient) {
            if(isToken) {
                require(Channels[_channelId].token.transferFrom(msg.sender, this, _balance),"deposit: token transfer failure");
                Channels[_channelId].erc20Balances[3] += _balance;
            } else {
                require(msg.value == _balance, "state balance does not match sent value");
                Channels[_channelId].ethBalances[3] += msg.value; 
            }
        }
        
        emit DidChannelDeposit(_channelId, recipient, _balance, isToken);
    }

    // TODO: Check there are no open virtual channels, the client should have cought this before signing a close channel state update
    function consensusCloseChannel(
        bytes32 _channelId, 
        uint256 _sequence, 
        uint256[4] _balances, // 0: ethBalanceA 1:ethBalanceI 2:tokenBalanceA 3:tokenBalanceI
        string _sigA, 
        string _sigI
    ) 
        public 
    {
        // assume num open thread is 0 and root hash is 0x0
        //require(Channels[_channelId].sequence < _sequence);
        require(Channels[_channelId].isOpen == true);
        uint256 totalEthDeposit = Channels[_channelId].initialDeposit[0] + Channels[_channelId].ethBalances[2] + Channels[_channelId].ethBalances[3];
        uint256 totalTokenDeposit = Channels[_channelId].initialDeposit[1] + Channels[_channelId].erc20Balances[2] + Channels[_channelId].erc20Balances[3];
        require(totalEthDeposit == _balances[0] + _balances[1]);
        require(totalTokenDeposit == _balances[2] + _balances[3]);

        bytes32 _state = keccak256(
            abi.encodePacked(
                _channelId,
                true,
                _sequence,
                uint256(0),
                bytes32(0x0),
                Channels[_channelId].partyAddresses[0], 
                Channels[_channelId].partyAddresses[1], 
                _balances[0], 
                _balances[1],
                _balances[2],
                _balances[3]
            )
        );

        require(Channels[_channelId].partyAddresses[0] == ECTools.recoverSigner(_state, _sigA));
        require(Channels[_channelId].partyAddresses[1] == ECTools.recoverSigner(_state, _sigI));

        Channels[_channelId].isOpen = false;

        if(_balances[0] != 0 || _balances[1] != 0) {
            Channels[_channelId].partyAddresses[0].transfer(_balances[0]);
            Channels[_channelId].partyAddresses[1].transfer(_balances[1]);
        }

        if(_balances[2] != 0 || _balances[3] != 0) {
            require(Channels[_channelId].token.transfer(Channels[_channelId].partyAddresses[0], _balances[2]),"happyCloseChannel: token transfer failure");
            require(Channels[_channelId].token.transfer(Channels[_channelId].partyAddresses[1], _balances[3]),"happyCloseChannel: token transfer failure");          
        }

        numChannels--;

        emit DidChannelClose(_channelId, _sequence, _balances[0], _balances[1], _balances[2], _balances[3]);
    }

    // Byzantine functions

    function updateChannelState(
        bytes32 _channelId, 
        uint256[6] updateParams, // [sequence, numOpenThread, ethbalanceA, ethbalanceI, tokenbalanceA, tokenbalanceI]
        bytes32 _threadRoot, 
        string _sigA, 
        string _sigI
    ) 
        public 
    {
        Channel storage channel = Channels[_channelId];
        require(channel.isOpen);
        require(channel.sequence < updateParams[0]); // do same as thread sequence check
        require(channel.ethBalances[0] + channel.ethBalances[1] >= updateParams[2] + updateParams[3]);
        require(channel.erc20Balances[0] + channel.erc20Balances[1] >= updateParams[4] + updateParams[5]);

        if(channel.isUpdateChannelSettling == true) { 
            require(channel.updateChannelTimeout > now);
        }
      
        bytes32 _state = keccak256(
            abi.encodePacked(
                _channelId,
                false, 
                updateParams[0], 
                updateParams[1], 
                _threadRoot, 
                channel.partyAddresses[0], 
                channel.partyAddresses[1], 
                updateParams[2], 
                updateParams[3],
                updateParams[4], 
                updateParams[5]
            )
        );

        require(channel.partyAddresses[0] == ECTools.recoverSigner(_state, _sigA));
        require(channel.partyAddresses[1] == ECTools.recoverSigner(_state, _sigI));

        // update channel state
        channel.sequence = updateParams[0];
        channel.numOpenThread = updateParams[1];
        channel.ethBalances[0] = updateParams[2];
        channel.ethBalances[1] = updateParams[3];
        channel.erc20Balances[0] = updateParams[4];
        channel.erc20Balances[1] = updateParams[5];
        channel.threadRootHash = _threadRoot;
        channel.isUpdateChannelSettling = true;
        channel.updateChannelTimeout = now + channel.confirmTime;

        // make settlement flag

        emit DidChannelUpdateState (
            _channelId, 
            updateParams[0], 
            updateParams[1], 
            updateParams[2], 
            updateParams[3],
            updateParams[4],
            updateParams[5], 
            _threadRoot,
            channel.updateChannelTimeout
        );
    }

    // supply initial state of thread to "prime" the force push game  
    function initThreadState(
        bytes32 _channelId, 
        bytes32 _threadId, 
        bytes _proof, 
        address _partyA, 
        address _partyB, 
        uint256[2] _bond,
        uint256[4] _balances, // 0: ethBalanceA 1:ethBalanceI 2:tokenBalanceA 3:tokenBalanceI
        string sigA
    ) 
        public 
    {
        require(Channels[_channelId].isOpen, "channel is closed.");
        // sub-channel must be open
        require(!Threads[_threadId].isClose, "thread is closed.");
        // Check time has passed on updateChannelTimeout and has not passed the time to store a thread state
        require(Channels[_channelId].updateChannelTimeout < now, "channel timeout not over.");
        // prevent rentry of initializing thread state
        require(Threads[_threadId].updateThreadTimeout == 0);
        // partyB is now Ingrid
        bytes32 _initState = keccak256(
            abi.encodePacked(_threadId, uint256(0), _partyA, _partyB, _bond[0], _bond[1], _balances[0], _balances[1], _balances[2], _balances[3])
        );

        // Make sure Alice has signed initial thread state (A/B in oldState)
        require(_partyA == ECTools.recoverSigner(_initState, sigA));

        // Check the oldState is in the root hash
        require(_isContained(_initState, _proof, Channels[_channelId].threadRootHash) == true);

        Threads[_threadId].partyA = _partyA; // thread participant A
        Threads[_threadId].partyB = _partyB; // thread participant B
        Threads[_threadId].sequence = uint256(0);
        Threads[_threadId].ethBalances[0] = _balances[0];
        Threads[_threadId].ethBalances[1] = _balances[1];
        Threads[_threadId].erc20Balances[0] = _balances[2];
        Threads[_threadId].erc20Balances[1] = _balances[3];
        Threads[_threadId].bond = _bond;
        Threads[_threadId].updateThreadTimeout = now + Channels[_channelId].confirmTime;
        Threads[_threadId].isInSettlementState = true;

        emit DidThreadInit(_channelId, _threadId, _proof, uint256(0), _partyA, _partyB, _balances[0], _balances[1]);
    }

    //TODO: verify state transition since the hub did not agree to this state
    // make sure the A/B balances are not beyond ingrids bonds  
    // Params: thread init state, thread final balance, vcID
    function settleThread(
        bytes32 _channelId, 
        bytes32 _threadId, 
        uint256 updateSeq, 
        address _partyA, 
        address _partyB,
        uint256[4] updateBal, // [ethupdateBalA, ethupdateBalB, tokenupdateBalA, tokenupdateBalB]
        string sigA
    ) 
        public 
    {
        require(Channels[_channelId].isOpen, "channel is closed.");
        // sub-channel must be open
        require(!Threads[_threadId].isClose, "thread is closed.");
        require(Threads[_threadId].sequence < updateSeq, "thread sequence is higher than update sequence.");
        require(
            Threads[_threadId].ethBalances[1] < updateBal[1] && Threads[_threadId].erc20Balances[1] < updateBal[3],
            "State updates may only increase recipient balance."
        );
        require(
            Threads[_threadId].bond[0] == updateBal[0] + updateBal[1] &&
            Threads[_threadId].bond[1] == updateBal[2] + updateBal[3], 
            "Incorrect balances for bonded amount");
        // Check time has passed on updateChannelTimeout and has not passed the time to store a thread state
        // Threads[_threadId].updateThreadTimeout should be 0 on uninitialized thread state, and this should
        // fail if initVC() isn't called first
        // require(Channels[_channelId].updateChannelTimeout < now && now < Threads[_threadId].updateThreadTimeout);
        require(Channels[_channelId].updateChannelTimeout < now); // for testing!

        bytes32 _updateState = keccak256(
            abi.encodePacked(
                _threadId, 
                updateSeq, 
                _partyA, 
                _partyB, 
                Threads[_threadId].bond[0], 
                Threads[_threadId].bond[1], 
                updateBal[0], 
                updateBal[1], 
                updateBal[2], 
                updateBal[3]
            )
        );

        // Make sure Alice has signed a higher sequence new state
        require(Threads[_threadId].partyA == ECTools.recoverSigner(_updateState, sigA));

        // store thread data
        // we may want to record who is initiating on-chain settles
        Threads[_threadId].challenger = msg.sender;
        Threads[_threadId].sequence = updateSeq;

        // channel state
        Threads[_threadId].ethBalances[0] = updateBal[0];
        Threads[_threadId].ethBalances[1] = updateBal[1];
        Threads[_threadId].erc20Balances[0] = updateBal[2];
        Threads[_threadId].erc20Balances[1] = updateBal[3];

        Threads[_threadId].updateThreadTimeout = now + Channels[_channelId].confirmTime;

        emit DidThreadSettle(_channelId, _threadId, updateSeq, updateBal[0], updateBal[1], msg.sender, Threads[_threadId].updateThreadTimeout);
    }

    function closeThread(bytes32 _channelId, bytes32 _threadId) public {
        // require(updateChannelTimeout > now)
        require(Channels[_channelId].isOpen, "channel is closed.");
        require(Threads[_threadId].isInSettlementState, "thread is not in settlement state.");
        require(Threads[_threadId].updateThreadTimeout < now, "Update thread timeout has not elapsed.");
        require(!Threads[_threadId].isClose, "thread is already closed");
        // reduce the number of open virtual channels stored on LC
        Channels[_channelId].numOpenThread--;
        // close thread flags
        Threads[_threadId].isClose = true;
        // re-introduce the balances back into the channel state from the settled VC
        // decide if this channel is alice or bob in the vc
        if(Threads[_threadId].partyA == Channels[_channelId].partyAddresses[0]) {
            Channels[_channelId].ethBalances[0] += Threads[_threadId].ethBalances[0];
            Channels[_channelId].ethBalances[1] += Threads[_threadId].ethBalances[1];

            Channels[_channelId].erc20Balances[0] += Threads[_threadId].erc20Balances[0];
            Channels[_channelId].erc20Balances[1] += Threads[_threadId].erc20Balances[1];
        } else if (Threads[_threadId].partyB == Channels[_channelId].partyAddresses[0]) {
            Channels[_channelId].ethBalances[0] += Threads[_threadId].ethBalances[1];
            Channels[_channelId].ethBalances[1] += Threads[_threadId].ethBalances[0];

            Channels[_channelId].erc20Balances[0] += Threads[_threadId].erc20Balances[1];
            Channels[_channelId].erc20Balances[1] += Threads[_threadId].erc20Balances[0];
        }

        emit DidThreadClose(_channelId, _threadId, Threads[_threadId].erc20Balances[0], Threads[_threadId].erc20Balances[1]);
    }


    // todo: allow ethier lc.end-user to nullify the settled channel state and return to off-chain
    function byzantineCloseChannel(bytes32 _channelId) public {
        Channel storage channel = Channels[_channelId];

        // check settlement flag
        require(channel.isOpen, "Channel is not open");
        require(channel.isUpdateChannelSettling == true);
        require(channel.numOpenThread == 0);
        require(channel.updateChannelTimeout < now, "channel timeout over.");

        // if off chain state update didnt reblance deposits, just return to deposit owner
        uint256 totalEthDeposit = channel.initialDeposit[0] + channel.ethBalances[2] + channel.ethBalances[3];
        uint256 totalTokenDeposit = channel.initialDeposit[1] + channel.erc20Balances[2] + channel.erc20Balances[3];

        uint256 possibleTotalEthBeforeDeposit = channel.ethBalances[0] + channel.ethBalances[1]; 
        uint256 possibleTotalTokenBeforeDeposit = channel.erc20Balances[0] + channel.erc20Balances[1];

        if(possibleTotalEthBeforeDeposit < totalEthDeposit) {
            channel.ethBalances[0]+=channel.ethBalances[2];
            channel.ethBalances[1]+=channel.ethBalances[3];
        } else {
            require(possibleTotalEthBeforeDeposit == totalEthDeposit);
        }

        if(possibleTotalTokenBeforeDeposit < totalTokenDeposit) {
            channel.erc20Balances[0]+=channel.erc20Balances[2];
            channel.erc20Balances[1]+=channel.erc20Balances[3];
        } else {
            require(possibleTotalTokenBeforeDeposit == totalTokenDeposit);
        }

        // reentrancy
        uint256 ethbalanceA = channel.ethBalances[0];
        uint256 ethbalanceI = channel.ethBalances[1];
        uint256 tokenbalanceA = channel.erc20Balances[0];
        uint256 tokenbalanceI = channel.erc20Balances[1];

        channel.ethBalances[0] = 0;
        channel.ethBalances[1] = 0;
        channel.erc20Balances[0] = 0;
        channel.erc20Balances[1] = 0;

        if(ethbalanceA != 0 || ethbalanceI != 0) {
            channel.partyAddresses[0].transfer(ethbalanceA);
            channel.partyAddresses[1].transfer(ethbalanceI);
        }

        if(tokenbalanceA != 0 || tokenbalanceI != 0) {
            require(
                channel.token.transfer(channel.partyAddresses[0], tokenbalanceA),
                "byzantineCloseChannel: token transfer failure"
            );
            require(
                channel.token.transfer(channel.partyAddresses[1], tokenbalanceI),
                "byzantineCloseChannel: token transfer failure"
            );          
        }

        channel.isOpen = false;
        numChannels--;

        emit DidChannelClose(_channelId, channel.sequence, ethbalanceA, ethbalanceI, tokenbalanceA, tokenbalanceI);
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

    //Struct Getters
    function getChannel(bytes32 id) public view returns (
        address[2],
        uint256[4],
        uint256[4],
        uint256[2],
        uint256,
        uint256,
        bytes32,
        uint256,
        uint256,
        bool,
        bool,
        uint256
    ) {
        Channel memory channel = Channels[id];
        return (
            channel.partyAddresses,
            channel.ethBalances,
            channel.erc20Balances,
            channel.initialDeposit,
            channel.sequence,
            channel.confirmTime,
            channel.threadRootHash,
            channel.openTimeout,
            channel.updateChannelTimeout,
            channel.isOpen,
            channel.isUpdateChannelSettling,
            channel.numOpenThread
        );
    }

    function getThread(bytes32 id) public view returns(
        bool,
        bool,
        uint256,
        address,
        uint256,
        address,
        address,
        address,
        uint256[2],
        uint256[2],
        uint256[2]
    ) {
        Thread memory thread = Threads[id];
        return(
            thread.isClose,
            thread.isInSettlementState,
            thread.sequence,
            thread.challenger,
            thread.updateThreadTimeout,
            thread.partyA,
            thread.partyB,
            thread.partyI,
            thread.ethBalances,
            thread.erc20Balances,
            thread.bond
        );
    }
}
