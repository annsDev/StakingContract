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
    let feeWallet;

    async function DeployStakingContract() {
        [owner, user1, user2, feeWallet] = await ethers.getSigners();


        const stakingCT = await ethers.getContractFactory("StakingContract");
        const stakingContract = await stakingCT.deploy();

        const StakingTK = await ethers.getContractFactory("StakingToken");
        const stakingToken = await StakingTK.deploy();

        const RewardingTK = await ethers.getContractFactory("RewardToken");
        const rewardingToken = await RewardingTK.deploy();

        await stakingContract.connect(owner).setFeeWallet(feeWallet);

        const rewardingAllowanceAmount = ethers.parseEther("1000");
        await rewardingToken.approve(stakingContract.target, rewardingAllowanceAmount);

        const stakingAllowanceAmount = ethers.parseEther("500");
        await stakingToken.approve(stakingContract.target, stakingAllowanceAmount);

        await stakingToken.connect(owner).transfer(user1, stakingAllowanceAmount);

        return { stakingContract, stakingToken, rewardingToken };
    }


    describe("Add pool and staking functionality by owner", function () {
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

            // Starting staking
            await stakingContract.connect(owner).startStaking(stakingToken);

            const checkPoolAfter = await stakingContract.pools(stakingToken);

            expect(checkPoolAfter.poolExists).to.be.true;

        });
        it("should allow the owner to update the pool APY%", async function () {

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

            await stakingContract.updatePoolAPY(stakingToken, 3);

            const checkPoolAPY = await stakingContract.pools(stakingToken);

            expect(checkPoolAPY.stakeAPY.toString()).to.equal('3');

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
        it("should allow the owner to pause staking", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            const poolName = "USDT";
            const stakeAPY = 5;
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

            await stakingContract.connect(owner).pauseStaking(stakingToken);

            const checkPoolAfter = await stakingContract.pools(stakingToken);
            expect(checkPoolAfter.stakingStarted).to.be.false;
        });
        it("should allow the owner to pause token claiming", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            const poolName = "USDT";
            const stakeAPY = 5;
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

            await stakingContract.connect(owner).pauseClaims(stakingToken);

            //User staking
            const stakingAmount = ethers.parseEther("500");
            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);


            await expect(stakingContract.connect(owner).claimRewards(stakingToken))
                .to.be.revertedWith("Claims are paused");
        });
        it("should allow the owner to resume token claiming", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            const poolName = "USDT";
            const stakeAPY = 5;
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

            await stakingContract.connect(owner).pauseClaims(stakingToken);


            //User staking
            const stakingAmount = ethers.parseEther("500");
            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            await stakingContract.connect(owner).startClaims(stakingToken);

            expect(await stakingContract.claimsPaused()).to.be.false;
        });
        it("should allow the owner to pause unstaking", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            const poolName = "USDT";
            const stakeAPY = 5;
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

            //User staking
            const stakingAmount = ethers.parseEther("500");
            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            await stakingContract.connect(owner).pauseUnstaking();

            await expect(stakingContract.connect(owner).unStake(stakingToken))
                .to.be.revertedWith("Unstaking is paused");

        });
        it("should allow the owner to resume unstaking", async function () {

            const { stakingContract, stakingToken, rewardingToken } = await loadFixture(DeployStakingContract);

            const poolName = "USDT";
            const stakeAPY = 5;
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

            //User staking
            const stakingAmount = ethers.parseEther("500");
            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            await stakingContract.connect(owner).pauseUnstaking();
            await stakingContract.connect(owner).startUnstaking();

            expect(await stakingContract.unstakingPaused()).to.be.false;

        });
    });

    describe("User staking and claiming operations", function () {
        beforeEach(async function () {
            const fixture = await loadFixture(DeployStakingContract);
            stakingContract = fixture.stakingContract;
            stakingToken = fixture.stakingToken;
            rewardingToken = fixture.rewardingToken;

            const poolName = "USDT";
            const stakeAPY = 5;
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
        })

        it("should allow the user to stake", async function () {

            await stakingContract.connect(owner).startStaking(stakingToken);

            const stakingAmount = ethers.parseEther("500");

            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            const userStakedAmount = await stakingContract.users(owner.address, stakingToken);
            expect(userStakedAmount.stakedAmount).to.equal('500000000000000000000');
        });
        it("should not allow user to stake if staking not started", async function () {

            const stakingAmount = ethers.parseEther("500");

            await expect(stakingContract.connect(owner).stake(stakingToken, stakingAmount))
                .to.be.revertedWithCustomError(stakingContract, "StakingNotStarted");
        });
        it("should allow the user to view staked token rewards", async function () {

            await stakingContract.connect(owner).startStaking(stakingToken);

            const stakingAmount = ethers.parseEther("500");


            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            var rewardPerSecond = await stakingContract.calculateRewardPerSecond(owner.address, stakingToken);
            rewardPerSecond = ethers.formatEther(rewardPerSecond).toString();

            //Reward for 5 mins 
            await ethers.provider.send('evm_increaseTime', [300]);
            await ethers.provider.send('evm_mine');

            var checkReward = await stakingContract.viewRewards(owner.address, stakingToken);
            checkReward = ethers.formatEther(checkReward).toString();

            var rewardEarned = (rewardPerSecond * 300).toString();

            expect(checkReward).to.equal(rewardEarned);
        });
        it("should not allow the user to view staked token rewards if pool does not exist", async function () {

            await stakingContract.connect(owner).startStaking(stakingToken);

            const stakingAmount = ethers.parseEther("500");

            await stakingContract.connect(owner).stake(stakingToken, stakingAmount);

            await expect(stakingContract.calculateRewardPerSecond(owner.address, rewardingToken))
                .to.be.revertedWithCustomError(stakingContract, "PoolNotExists");
        });
        it("should allow the user to claim earned reward", async function () {

            //Owner started staking
            await stakingContract.connect(owner).startStaking(stakingToken);


            //User staked
            const stakingAmount = ethers.parseEther("500");
            await stakingToken.connect(user1).approve(stakingContract.target, stakingAmount);
            await stakingContract.connect(user1).stake(stakingToken, stakingAmount);

            //Increasing the time to one day
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine');


            const blockNum = await ethers.provider.getBlockNumber();
            const blockT = await ethers.provider.getBlock(blockNum);
            var T2 = blockT.timestamp.toString();

            var rewardPErSecond = await stakingContract.calculateRewardPerSecond(user1.address, stakingToken);
            rewardPErSecond = rewardPErSecond.toString();

            //user claiming the tokens after one day passed
            await stakingContract.connect(user1).claimRewards(stakingToken);

            var balanceRewardAfter = await rewardingToken.balanceOf(user1);
            balanceRewardAfter = ethers.formatEther(balanceRewardAfter).toString();
            // console.log("balanceReward 1st Claim", balanceRewardAfter);

            var userStakedAmount = await stakingContract.users(user1.address, stakingToken);
            userStakedAmount = ethers.formatEther(userStakedAmount.reward).toString();

            expect(balanceRewardAfter).to.equal(userStakedAmount);
        });
        it("should not allow the user to claim if not staked", async function () {

            //Owner started staking
            await stakingContract.connect(owner).startStaking(stakingToken);

            //Increasing the time to one day
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine');

            await expect(stakingContract.connect(user1).claimRewards(stakingToken))
            .to.be.revertedWithCustomError(stakingContract, "NoAmountStaked");
        });
        it("should allow the user to unstake the staked amount", async function () {

            //Owner started staking
            await stakingContract.connect(owner).startStaking(stakingToken);

            //User staked
            const stakingAmount = ethers.parseEther("500");
            await stakingToken.connect(user1).approve(stakingContract.target, stakingAmount);

            //balance before staking the amount 
            var balanceBeforeStake = await stakingToken.balanceOf(user1);
            balanceBeforeStake = ethers.formatEther(balanceBeforeStake).toString();
            console.log("balanceBeforeStake", balanceBeforeStake);

            //reward balance before staking
            var balanceRewardBefore = await rewardingToken.balanceOf(user1);
            balanceRewardBefore = ethers.formatEther(balanceRewardBefore).toString();
            console.log("balanceRewardBefore", balanceRewardBefore);

            //user staked the amount 
            await stakingContract.connect(user1).stake(stakingToken, stakingAmount);

            //Increasing the time to one day
            await ethers.provider.send('evm_increaseTime', [86400 * 2]);
            await ethers.provider.send('evm_mine');

            await stakingContract.connect(user1).unStake(stakingToken);

            //balance after staking the amount 
            var balanceAfterStake = await stakingToken.balanceOf(user1);
            balanceAfterStake = ethers.formatEther(balanceAfterStake).toString();
            console.log("balanceAfterStake", balanceAfterStake);

            //reward balance after staking
            var balanceRewardAfter = await rewardingToken.balanceOf(user1);
            balanceRewardAfter = ethers.formatEther(balanceRewardAfter).toString();
            console.log("balanceRewardAfter", balanceRewardAfter);

            expect(balanceBeforeStake).to.equal(balanceAfterStake);
        });
        it.only("should deduct fee if user to unstake the staked amount before pool validity is remaining", async function () {

            //Owner started staking
            await stakingContract.connect(owner).startStaking(stakingToken);

            //User staked
            const stakingAmount = ethers.parseEther("500");
            await stakingToken.connect(user1).approve(stakingContract.target, stakingAmount);

            //balance before staking the amount 
            var balanceBeforeStake = await stakingToken.balanceOf(user1);
            balanceBeforeStake = ethers.formatEther(balanceBeforeStake).toString();
            balanceBeforeStake = (balanceBeforeStake - (2.5)).toString();
            console.log("balanceBeforeStake", balanceBeforeStake);

            //user staked the amount 
            await stakingContract.connect(user1).stake(stakingToken, stakingAmount);

            //unstake fee %
            var unstakeFee = await stakingContract.UNSTAKE_FEE();
            console.log("unstakeFee", unstakeFee.toString()); // fee percentage is 5%

            //Increasing the time to one day
            await ethers.provider.send('evm_increaseTime', [86400]);
            await ethers.provider.send('evm_mine');

            await stakingContract.connect(user1).unStake(stakingToken);

            //balance after staking the amount 
            var balanceAfterStake = await stakingToken.balanceOf(user1);
            balanceAfterStake = ethers.formatEther(balanceAfterStake).toString();
            console.log("balanceAfterStake", balanceAfterStake);

            expect(balanceAfterStake).to.equal(balanceBeforeStake);
        });
    })
});
