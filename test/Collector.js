const { expect } = require("chai");
const { ethers } = require('hardhat');

describe("Collector.sol", function() {

    let DAO, dao, Marketplace, marketplace;
    let owner, addr1, addr2, addr3, addr4, nft, addrs;
 
    let proposalArgs;
    let signature, signature1, signature2;

    beforeEach(async function () {

        [owner, addr1, addr2, addr3, addr4, nft, ...addrs] = await ethers.getSigners();
        DAO = await ethers.getContractFactory("Collector");
        dao = await DAO.deploy();

        Marketplace = await ethers.getContractFactory("NFTContract");
        marketplace = await Marketplace.deploy();

        proposalArgs = [ [dao.address], [0], 
            [dao.interface.encodeFunctionData("buyFromNftMarketplace", 
            [marketplace.address, nft.address, 1, ethers.utils.parseEther("1000")])], 
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Buying NFT 1"))];

        await dao.connect(owner).becomeMember( {
            value: ethers.utils.parseEther("1")
        });
    
        await dao.connect(owner).propose(...proposalArgs);

    })

    describe("Becoming a member", function () {

        it('Cannot contribute less than 1 ether to become a member', async function () {
            await expect(dao.connect(addr1).becomeMember({
                value: ethers.utils.parseEther("0.5")
            })).to.be.revertedWith("ONE_ETHER");
        })

        it('Cannot contribute more than 1 ether to become a member', async function () {
            await expect(dao.connect(addr1).becomeMember({
                value: ethers.utils.parseEther("1.5")
            })).to.be.revertedWith("ONE_ETHER");
        })

        it('Cannot become a member more than once', async function () {

            dao.connect(addr1).becomeMember({
                value: ethers.utils.parseEther("1")
            });

            await expect(dao.connect(addr1).becomeMember({
                value: ethers.utils.parseEther("1")
            })).to.be.revertedWith("ALREADY_MEMBER");
        })

    });

    describe("Proposals", function () {

        it("Only a member can propose an NFT to buy.", async function () {
            
            await expect(dao.connect(addr1).propose(...proposalArgs)).to.be.revertedWith("NOT_A_MEMBER");
        });
    
        it("First proposal", async function () {

            const p = await dao.proposals(await dao.hashProposal(...proposalArgs));

            expect( await p.id).to.equal(await dao.hashProposal(...proposalArgs));

            expect( await p.proposer).to.equal(owner.address);
            expect( await p.forVotes).to.equal(0);
            expect( await p.againstVotes).to.equal(0);
            expect( await p.abstainVotes).to.equal(0);
            expect( await p.executed).to.equal(false);

        })
   
    });
    

    describe("Voting", function () {

        it('reverts if the signatory is invalid', async function () {

            await expect(dao.castVoteBySig(await dao.hashProposal(...proposalArgs), 0, 0, 
            "0x7465737400000000000000000000000000000000000000000000000000000000", "0x7465737400000000000000000000000000000000000000000000000000000000")).to.be.revertedWith("INVALID_SIGNATURE");
          });


        it("Updates", async function () {

            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);

            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);


            await dao.castVoteBySig(id, supp, v, r, s);

            const p = await dao.proposals(id);

            expect( await p.forVotes).to.equal(1);
            expect( await p.againstVotes).to.equal(0);
            expect( await p.abstainVotes).to.equal(0);
            
        })

        it("Cannot vote if not a member", async function () {
            
            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);
   
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);

            await expect(dao.connect(addr1).castVoteBySig(id, supp, v, r, s)).to.be.revertedWith("NOT_A_MEMBER");

        })
    

        it("Cannot vote more than once", async function () {
            
            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);
   
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);


            await dao.castVoteBySig(id, supp, v, r, s);

            await expect(dao.castVoteBySig(id, supp, v, r, s)).to.be.revertedWith("ALREADY_VOTED");
        })
   

        it("Cannot vote after deadline", async function () {
            
            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);
   
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);

            const fourDays = 4 * 24 * 60 * 60;
            
            await network.provider.send('evm_increaseTime', [fourDays]);
            await network.provider.send('evm_mine');

            await expect(dao.castVoteBySig(id, supp, v, r, s)).to.be.revertedWith("VOTING_CLOSED");

        })

        it("Invalid vote type", async function () {
            
            const supp = 3;
            const id = await dao.hashProposal(...proposalArgs);
   
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);


            await expect(dao.castVoteBySig(id, supp, v, r, s)).to.be.revertedWith("INVALID_VOTE_TYPE");
        })

    })

    describe("Not successful", function () {

        it("More no votes than yes votes", async function () {

            const supp = 0;
            const id = await dao.hashProposal(...proposalArgs);

            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);


            await dao.castVoteBySig(id, supp, v, r, s);

            const fourDays = 4 * 24 * 60 * 60;
            
            await network.provider.send('evm_increaseTime', [fourDays]);
            await network.provider.send('evm_mine');


            await expect(dao.execute(...proposalArgs)).to.be.revertedWith("PROPOSAL_HAS_NOT_SUCCEEDED");
              

        })

        it("Quota not reached", async function () {
      
            dao.connect(addr1).becomeMember({
                value: ethers.utils.parseEther("1")
            });
            dao.connect(addr2).becomeMember({
                value: ethers.utils.parseEther("1")
            });
            dao.connect(addr3).becomeMember({
                value: ethers.utils.parseEther("1")
            });
            dao.connect(addr4).becomeMember({
                value: ethers.utils.parseEther("1")
            });

            const supp = 0;
            const id = await dao.hashProposal(...proposalArgs);

            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
    
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };

            const value = { proposalId: id, support: supp };

            signature = await owner._signTypedData(domain, types, value);

            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);


            await dao.castVoteBySig(id, supp, v, r, s);

            const fourDays = 4 * 24 * 60 * 60;
            
            await network.provider.send('evm_increaseTime', [fourDays]);
            await network.provider.send('evm_mine');

            await expect(dao.execute(...proposalArgs)).to.be.revertedWith("PROPOSAL_HAS_NOT_SUCCEEDED");
              
        })
    })

    describe("Voting in bulk", function () {

        it("Update" , async function () {

            await dao.connect(addr1).becomeMember( {
                value: ethers.utils.parseEther("1")
            });

            await dao.connect(addr2).becomeMember( {
                value: ethers.utils.parseEther("1")
            });

            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);
    
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
        
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };
    
            const value = { proposalId: id, support: supp };
    
            signature1 = await owner._signTypedData(domain, types, value);
            signature2 = await addr1._signTypedData(domain, types, value);

            const r1 = '0x' + signature1.substring(2).substring(0, 64);
            const s1 = '0x' + signature1.substring(2).substring(64, 128);
            const v1 = '0x' + signature1.substring(2).substring(128, 130);
            const tp1 = addr2.address;

            const r2 = '0x' + signature2.substring(2).substring(0, 64);
            const s2 = '0x' + signature2.substring(2).substring(64, 128);
            const v2 = '0x' + signature2.substring(2).substring(128, 130);
            const tp2 = addr2.address;

            const idArr = [id, id];
            const supArr = [supp, supp];
            const rArr = [r1, r2];
            const sArr = [s1, s2];
            const vArr = [v1, v2];
            const tpArr = [tp1, tp2];

            await dao.connect(addr2).voteBySigs(idArr, supArr, vArr, rArr, sArr, tpArr);

            const p = await dao.proposals(id);

            expect( await p.proposer).to.equal(owner.address);
            expect( await p.forVotes).to.equal(2);
            expect( await p.againstVotes).to.equal(0);
            expect( await p.abstainVotes).to.equal(0);
            expect( await p.executed).to.equal(false);

        })

    });

    describe("Executing", function () {

        it("Test transfer", async function () {

            await dao.connect(addr1).becomeMember( {
                value: ethers.utils.parseEther("1")
            });

            const supp = 1;
            const id = await dao.hashProposal(...proposalArgs);
    
            const a = dao.address;
            const domain = { name: 'Collector', chainId: 1, verifyingContract: a };
        
            const types = {
                Ballot: [
                    { name: 'proposalId', type: 'uint256' },
                    { name: 'support', type: 'uint8' }
                ]
            };
    
            const value = { proposalId: id, support: supp };
    
            signature = await owner._signTypedData(domain, types, value);
    
            const r = '0x' + signature.substring(2).substring(0, 64);
            const s = '0x' + signature.substring(2).substring(64, 128);
            const v = '0x' + signature.substring(2).substring(128, 130);
    
            await dao.castVoteBySig(id, supp, v, r, s);

            const fourDays = 4 * 24 * 60 * 60;
            
            await network.provider.send('evm_increaseTime', [fourDays]);
            await network.provider.send('evm_mine');

            await dao.execute(...proposalArgs);

            expect( await marketplace.getOwner(nft.address, 1)).to.equal(dao.address);

        });
        

    });

    

});