//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NftMarketplace.sol";

contract NFTContract is NftMarketplace {
  mapping (uint => address) public tokens; 
  uint price = 2 ether;

  function getPrice(address _addr, uint _tokenId) override external view returns (uint) {
    return price;
  }
  function buy(address _addr, uint _tokenId) override external payable returns (bool success){
    require(msg.value >= price, "INSUFFICIENT_ETHER");
    tokens[_tokenId] = msg.sender;
    return true;
  }

  function getOwner(address _addr, uint _tokenId) external view returns (address) {
    return tokens[_tokenId];
  }
}