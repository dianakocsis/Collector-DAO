const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Deploying contracts with the account:", deployer.address);
  
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const DAO = await ethers.getContractFactory("Collector");
    const dao = await DAO.deploy();

    const Marketplace = await ethers.getContractFactory("NFTContract");
    const marketplace = await Marketplace.deploy();
  
    console.log("Dao address:", dao.address);
    console.log("Marketplace address:", marketplace.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });