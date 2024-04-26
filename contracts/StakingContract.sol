// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title Staking Contract
/// @author Anns Khalid
/// @notice Implements the logic for Staking Contract
/// @dev Allows multiple users to stake tokens on multiple pools

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    /// @notice APY % can not be a null value
    error InvalidStakeAPY();

    /// @notice Reward allowance can not be a null value
    error InvalidAllowance();

    /// @notice Already created pool for same token can not be created twice
    error PoolAlreadyExists();

    /// @notice Pool does not exist for the provided token
    error PoolNotExists();

    /// @notice The staked amount can not be zero
    error InvalidStakeAmount();

    /// @notice No amount is staked for particular user
    error NoAmountStaked();

    /// @notice Same token already staked by user
    error AlreadyStaked();

    /// @notice Staking already started
    error StakingStarted();

    /// @notice Staking not started yet
    error StakingNotStarted();

    /// @notice Pool expire time reached
    error PoolEnded();

    using SafeMath for uint256;
    address public feeWallet;
    bool public stakingPaused;
    bool public claimsPaused;
    bool public unstakingPaused;
    uint256 constant SEC_IN_YEAR = 365 * 24 * 60 * 60;
    uint256 constant HUNDERED = 100;
    uint256 constant THOUSAND = 1000;
    uint256 public UNSTAKE_FEE = 5;

    struct User {
        uint256 stakedAmount;
        uint256 depositTime;
        uint256 lastClaimTime;
        uint256 reward;
    }

    struct Pool {
        string poolName;
        uint256 stakeAPY;
        address stakingToken; //can be same as rewarding token
        address rewardToken;
        uint256 stakingStartTime;
        uint256 poolValidityPeriod; //unixtime-stamp
        bool stakingStarted;
        bool poolExists;
    }

    /* ========== STORAGE ========== */

    mapping(address => Pool) public pools; //stakingToken => Pool{}
    mapping(address => mapping(address => User)) public users; // user => token => userStruct{}

    /* ========== EVENTS ========== */

    event Staked(address indexed user, address indexed token, uint256 amount);
    event UnStaked(address indexed user, address indexed token, uint256 amount);
    event RewardPaid(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event PoolAdded(
        string poolName,
        address token,
        uint256 stakeAPY,
        address stakingToken,
        address rewardToken,
        uint256 poolValidityPeriod //days
    );
    event PoolUpdated(address token, uint256 newRewardPercentage);

    constructor() Ownable() {}

    /* ========== MODIFIERS ========== */

    modifier stakingStarted(address token) {
        if (pools[token].stakingStarted) {
            revert StakingStarted();
        }
        _;
    }

    modifier stakingNotStarted(address token) {
        if (!pools[token].stakingStarted) {
            revert StakingNotStarted();
        }
        _;
    }

    modifier whenNotPaused() {
        require(!stakingPaused, "Staking is paused");
        _;
    }

    modifier whenClaimsNotPaused() {
        require(!claimsPaused, "Claims are paused");
        _;
    }

    modifier whenUnstakingNotPaused() {
        require(!unstakingPaused, "Unstaking is paused");
        _;
    }

    function startStaking(
        address token
    ) external onlyOwner stakingStarted(token) {
        Pool storage pool = pools[token];

        pool.stakingStartTime = block.timestamp;
        pool.poolValidityPeriod += block.timestamp; //from the day staking started + validityDays
        pool.stakingStarted = true;
    }

    function pauseStaking(
        address token
    ) external onlyOwner stakingNotStarted(token) {
        Pool storage pool = pools[token];
        pool.stakingStarted = false;
    }

    function pauseClaims() external onlyOwner {
        claimsPaused = true;
    }

    function startClaims() external onlyOwner {
        claimsPaused = false;
    }

    // it will halt all stakings
    function pauseUnstaking() external onlyOwner {
        unstakingPaused = true;
    }

    function startUnstaking() external onlyOwner {
        unstakingPaused = false;
    }

    function setFeeWallet(address _feeWallet) external onlyOwner {
        feeWallet = _feeWallet;
    }

    function stake(
        address token,
        uint256 amount
    ) public stakingNotStarted(token) {
        if (amount <= 0) {
            revert InvalidStakeAmount();
        }
        if (!pools[token].poolExists) {
            revert PoolNotExists();
        }
        if (block.timestamp >= pools[token].poolValidityPeriod) {
            revert PoolEnded();
        }

        //If user already staked tokens
        if (users[msg.sender][token].stakedAmount > 0) {
            updateRewards(msg.sender, token);
        }

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        users[msg.sender][token].depositTime = block.timestamp;
        users[msg.sender][token].lastClaimTime = block.timestamp;
        users[msg.sender][token].stakedAmount += amount; //previouslyStaked + NewStakedAmount = StakedAmount

        emit Staked(msg.sender, token, amount);
    }

    function calculateRewardPerSecond(
        address user,
        address token
    ) public view returns (uint256) {
        Pool storage pool = pools[token];
        if (!pool.poolExists) {
            revert PoolNotExists();
        }
        uint256 rewardPercentage = pool.stakeAPY;
        return
            users[user][token]
                .stakedAmount
                .mul(rewardPercentage)
                .div(HUNDERED)
                .div(SEC_IN_YEAR);
    }

    function updateRewards(address user, address token) internal {
        uint256 currentTime = block.timestamp;
        uint256 lastClaimTime = users[user][token].lastClaimTime;
        uint256 elapsedTime = currentTime.sub(lastClaimTime);

        uint256 rewardPerSecond = calculateRewardPerSecond(user, token); // 0.000000792744799594 * 86400
        uint256 accumulatedReward = rewardPerSecond.mul(elapsedTime);

        users[user][token].reward = accumulatedReward;
        users[user][token].lastClaimTime = currentTime;
    }

    function claimRewards(address token) public whenClaimsNotPaused {
        Pool storage pool = pools[token];
        if (!pool.poolExists) {
            revert PoolNotExists();
        }
        if (users[msg.sender][token].stakedAmount == 0) {
            revert NoAmountStaked();
        }

        updateRewards(msg.sender, token);

        uint256 reward = users[msg.sender][token].reward; //68493943430000000 68493943429721194
        address rewardToken = pool.rewardToken;

        IERC20(rewardToken).transfer(msg.sender, reward);

        emit RewardPaid(msg.sender, token, reward);
    }

    function unStake(address token) external whenUnstakingNotPaused {
        claimRewards(token); // claim any pending rewards

        uint256 stakedAmount = users[msg.sender][token].stakedAmount;

        Pool storage pool = pools[token];
        uint256 validityPeriod = pool.poolValidityPeriod;

        if (block.timestamp < validityPeriod) {
            uint256 fee = stakedAmount.mul(UNSTAKE_FEE).div(THOUSAND); // 5% fee
            stakedAmount = stakedAmount.sub(fee);

            if (feeWallet != address(0)) {
                IERC20(token).transfer(feeWallet, fee);
            }
        }

        // staked tokens will be transferred here
        IERC20(token).transfer(msg.sender, stakedAmount);

        users[msg.sender][token].stakedAmount = 0;
        users[msg.sender][token].reward = 0;

        emit UnStaked(msg.sender, token, stakedAmount);

        // delete users[msg.sender][token];
    }

    function addPool(
        string memory poolName,
        address token,
        uint256 stakeAPY,
        address stakingToken,
        address rewardToken,
        uint256 poolValidityPeriod,
        uint256 allowanceAmount
    ) external onlyOwner {
        if (pools[token].poolExists) {
            revert PoolAlreadyExists();
        }
        if (stakeAPY <= 0) {
            revert InvalidStakeAPY();
        }
        if (allowanceAmount <= 0) {
            revert InvalidAllowance();
        }

        pools[token] = Pool({
            poolName: poolName,
            stakeAPY: stakeAPY,
            stakingToken: stakingToken,
            rewardToken: rewardToken,
            stakingStartTime: 0,
            poolValidityPeriod: poolValidityPeriod,
            stakingStarted: false,
            poolExists: true
        });

        // Grant allowance to this contract for the rewarding token
        IERC20(rewardToken).transferFrom(
            msg.sender,
            address(this),
            allowanceAmount
        );

        emit PoolAdded(
            poolName,
            token,
            stakeAPY,
            stakingToken,
            rewardToken,
            poolValidityPeriod
        );
    }

    //cannot be updateable once the staking starts
    function updatePoolAPY(
        address token,
        uint256 newRewardPercentage
    ) external onlyOwner stakingStarted(token) {
        if (!pools[token].poolExists) {
            revert PoolNotExists();
        }
        if (newRewardPercentage <= 0) {
            revert InvalidStakeAPY();
        }

        pools[token].stakeAPY = newRewardPercentage;

        emit PoolUpdated(token, newRewardPercentage);
    }

    function viewRewards(
        address user,
        address token
    ) external view returns (uint256) {
        uint256 rewardPerSecond = calculateRewardPerSecond(user, token);
        uint256 lastClaimTimeUser = users[user][token].lastClaimTime;
        uint256 currentTime = block.timestamp;
        uint256 elapsedTime = currentTime.sub(lastClaimTimeUser);
        uint256 accruedRewards = users[user][token].reward;

        if (elapsedTime > 0) {
            accruedRewards = accruedRewards.add(
                rewardPerSecond.mul(elapsedTime)
            );
        }

        return accruedRewards;
    }

    function contractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function feeWalletBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(feeWallet);
    }
}
