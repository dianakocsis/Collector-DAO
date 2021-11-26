require("@nomiclabs/hardhat-waffle");

const ALCHEMY_API_KEY = "XBWDH7_FZLdTbx1Z1wFkLmOtif4tNSpp";

const ROPSTEN_PRIVATE_KEY = "3e8c6b8420c25dbd909c18a0417a2e5ab8f83836e713af63a05830f3a0008444";

module.exports = {
  solidity: "0.8.0",
  networks: {
    ropsten: {
    url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
    accounts: [`${ROPSTEN_PRIVATE_KEY}`]
    }
  }
};
