const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { hours } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration");

describe("StakingContract", function () {
    let StakingContract;
    let stakingContract;
    let owner;
    let user1;
    let user2;
    let token;

    async function DeployStakingContract() {
        [owner, user1, user2] = await ethers.getSigners();


        const stakingCT = await ethers.getContractFactory("StakingContract");
        const stakingContract = await stakingCT.deploy();

        const StakingTK = await ethers.getContractFactory("StakingToken");
        const stakingToken = await StakingTK.deploy();

        const RewardingTK = await ethers.getContractFactory("RewardToken");
        const rewardingToken = await RewardingTK.deploy();

        const rewardingAllowanceAmount = ethers.parseEther("1000");
        await rewardingToken.approve(stakingContract.target, rewardingAllowanceAmount);

        const stakingAllowanceAmount = ethers.parseEther("500");
        await stakingToken.approve(stakingContract.target, stakingAllowanceAmount);

        // const balanceOfStaking = await stakingToken.balanceOf(owner);
        // console.log(balanceOfStaking, "<---- Owner staking balance");

        // const balanceOfReward = await rewardingToken.balanceOf(owner);
        // console.log(balanceOfReward, "<----- Owner reward balance");


        return { stakingContract, stakingToken, rewardingToken };
    }


    describe("Add pool and staking functionality", function () {
        it("should allow the owner to create a pool", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            // Add a pool by the owner
            const poolName = "USDT";
            const stakeAPY = 5; //0.5%
            const poolValidityPeriod = 86400;

            const rewardingAllowanceAmount = ethers.parseEther("1000");

            await stakingContract.connect(owner).addPool(
                poolName,
                stakingToken,
                stakeAPY,
                stakingToken,
                rewardingToken,
                poolValidityPeriod,
                rewardingAllowanceAmount
            );

            const checkPool = await stakingContract.pools(stakingToken);
            console.log("Before Staking", checkPool);

            // Starting staking
            await stakingContract.connect(owner).startStaking(stakingToken);

            const checkPoolAfter = await stakingContract.pools(stakingToken);

            expect(checkPoolAfter.poolExists).to.be.true;

        });
        it("should allow the owner to start staking", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);


            // Add a pool by the owner
            const poolName = "USDT";
            const stakeAPY = 5; //0.5%
            const poolValidityPeriod = 86400;
            const rewardingAllowanceAmount = ethers.parseEther("1000");

            await stakingContract.connect(owner).addPool(
                poolName,
                stakingToken,
                stakeAPY,
                stakingToken,
                rewardingToken,
                poolValidityPeriod,
                rewardingAllowanceAmount
            );

            // Starting staking
            await stakingContract.connect(owner).startStaking(stakingToken);
            const checkPoolAfter = await stakingContract.pools(stakingToken);

            expect(checkPoolAfter.stakingStarted).to.be.true;
        });
        it.only("should allow the user to stake", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            // Add a pool by the owner
            const poolName = "USDT";
            const stakeAPY = 5; //0.5%
            const poolValidityPeriod = 86400 * 2;
            const rewardingAllowanceAmount = ethers.parseEther("1000");

            await stakingContract.connect(owner).addPool(
                poolName,
                stakingToken,
                stakeAPY,
                stakingToken,
                rewardingToken,
                poolValidityPeriod,
                rewardingAllowanceAmount
            );

            // Starting staking
            await stakingContract.connect(owner).startStaking(stakingToken);
            

            // Staking by a user
            // await token.connect(user1).approve(stakingContract.address, 100); // Approve tokens for staking
            const stakingAmount = ethers.parseEther("500");

            const blockNum = await ethers.provider.getBlockNumber();
            const blockT = await ethers.provider.getBlock(blockNum);
            console.log("Block Timestamp Before:", blockT.timestamp);

            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);


            // Check if the user has staked tokens
            const userStakedAmount = await stakingContract.users(owner.address, stakingToken);
            // expect(userStakedAmount.stakedAmount).to.equal(100);

            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine');


            const blockNumber = await ethers.provider.getBlockNumber();
            const block = await ethers.provider.getBlock(blockNumber);
            console.log("Block Timestamp After:", block.timestamp);

            const rewardPerSecond = await stakingContract.calculateRewardPerSecond(owner.address, stakingToken);
            console.log("rewardPerSecond", ethers.formatEther(rewardPerSecond));


            const checkReward = await stakingContract.viewRewards(owner.address, stakingToken);
            console.log("checkReward", ethers.formatEther(checkReward))
        });
    });

});
