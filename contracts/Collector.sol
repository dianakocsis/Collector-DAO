// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NftMarketplace.sol";

contract Collector {

    string public constant name = "Collector";

    uint constant VOTE_TIME = 3 days;

    bool executing;

    address[] public members;
    mapping(address => bool) isMember;

    struct Proposal {
        uint id;
        address proposer;

        bool executed;

        uint startTime;
        uint endTime;

        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
        mapping(address => bool) hasVoted;
    }

    enum ProposalState {
        Active,
        Failed,
        Succeeded,
        Executed
    }

    mapping (uint => Proposal) public proposals;

    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");
    
    bool internal locked;
    uint signatureId;

    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyMember {
        require(isMember[msg.sender], "NOT_A_MEMBER");
        _;
    }

    function becomeMember() external payable {
        require(!isMember[msg.sender], "ALREADY_MEMBER");
        require(msg.value == 1 ether, "ONE_ETHER");
        isMember[msg.sender] = true;
        members.push(msg.sender);
    }

    function quorumVotes() public view returns (uint) {
        return (25 * members.length) / 100;
    }

    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure virtual returns (uint256) {
        return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external onlyMember returns (uint) {

        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);

        require(targets.length == values.length, "INVALID_PROPOSAL_LENGTH");
        require(targets.length == values.length, "INVALID_PROPOSAL_LENGTH");
        require(targets.length == calldatas.length, "INVALID_PROPOSAL_LENGTH");

        uint startTime = block.timestamp;
        uint endTime = startTime + VOTE_TIME;
        Proposal storage newProposal = proposals[proposalId];
        
        newProposal.id = proposalId;
        newProposal.startTime = startTime;
        newProposal.endTime = endTime;
        newProposal.proposer = msg.sender;
    
        return newProposal.id;
    }

    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public onlyMember returns (uint) {

        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);

        ProposalState status = state(proposalId);
        
        require(status == ProposalState.Succeeded, "PROPOSAL_HAS_NOT_SUCCEEDED");

        executing = true;

        _execute(targets, values, calldatas);

        proposals[proposalId].executed = true;
        executing = false;

        return proposalId;

    }

    function _execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) internal virtual {

        string memory errorMessage = "CALL_REVERTED";
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
            if (!success) {
                if (returndata.length > 0) {
                    assembly {
                        let returndata_size := mload(returndata)
                        revert(add(32, returndata), returndata_size)
                    }
                }
                else {
                    revert(errorMessage);
                }
            }
        }
        
    }

    function state(uint proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp <= proposal.endTime) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || (proposal.forVotes + proposal.againstVotes) < quorumVotes()) {
            return ProposalState.Failed;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else {
            return ProposalState.Succeeded;
        }
    }

    function castVoteBySig(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) onlyMember public {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainIdInternal(), address(this)));
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "INVALID_SIGNATURE");
        castVoteInternal(signatory, proposalId, support);
    }

    function castVoteInternal(address voter, uint proposalId, uint8 support) internal {
        require(state(proposalId) == ProposalState.Active, "VOTING_CLOSED");
        require(support <= 2, "INVALID_VOTE_TYPE");
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasVoted[voter], "ALREADY_VOTED");

        if (support == 0) {
            proposal.againstVotes += 1;
        }
        else if (support == 1) {
            proposal.forVotes += 1;
        }
        else if (support == 2) {
            proposal.abstainVotes += 1;
        }

        proposal.hasVoted[voter] = true;
    }

    function voteBySigs(uint[] memory proposalId, uint8[] memory support, uint8[] memory v, bytes32[] memory r, bytes32[] memory s, address[] memory thirdParty) public {
        for (uint i = 0; i < proposalId.length; i++) {
            require(thirdParty[i] == msg.sender, "NOT_TRUSTED");
            castVoteBySig(proposalId[i], support[i], v[i], r[i], s[i]);
        }
    }

    function getChainIdInternal() internal view returns (uint) {
        uint chainId;
        assembly { chainId := chainid() }
        return chainId;
    }

    function buyFromNftMarketplace(NftMarketplace marketplace, address nftContract, uint nftId, uint maxPrice) noReentrant external {
        require(executing, "NOT_EXECUTING");
        uint price = marketplace.getPrice(nftContract, nftId);
        require(price <= maxPrice, "INSUFFICIENT_AMOUNT");
        (bool success) = marketplace.buy{ value: price }(nftContract, nftId);
        require(success, "FAILED_TO_BUY");
    }

}