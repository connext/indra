pragma solidity 0.5.11;


contract DelegateProxy {
    function () external payable { }

    mapping(address => uint256) public totalAmountWithdrawn;

    function delegate(address to, bytes memory data) public {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, ) = to.delegatecall(data);
        require(success, "Delegate call failed.");
    }

    function increaseTotalAmountWithdrawn(address assetId, uint256 amount) public {
        totalAmountWithdrawn[assetId] += amount;
    }
}
