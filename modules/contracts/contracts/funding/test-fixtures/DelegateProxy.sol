pragma solidity 0.5.11;


contract DelegateProxy {
    function () external payable { }
    function delegate(address to, bytes memory data) public {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, ) = to.delegatecall(data);
        require(success, "Delegate call failed.");
    }
}
