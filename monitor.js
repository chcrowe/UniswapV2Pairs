const ethers = require("ethers");
const moment = require("moment-timezone");
const config = require("./config.json");
require("dotenv").config();

const WS_NODE_PROVIDER_URL = `${process.env.WS_NODE_PROVIDER_URL}`;
const UNISWAP_V2_PAIR_ADDRESS = config.UNISWAP_V2_PAIR_ADDRESS;
const PRIMARY_TOKEN_SYMBOL = config.PRIMARY_TOKEN_SYMBOL;

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// Subset ABI for the Uniswap V2 Pair
const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint)",
  "function balanceOf(address owner) external view returns (uint)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// ERC20 ABI (for getting token decimals)
const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

class Token {
    constructor(address, symbol, decimals, reserves) {
        this.address = address;
        this.symbol = symbol;
        this.decimals = decimals;
        this.reserves = reserves;
    }

    formatAmount(amount) {
        return ethers.formatUnits(amount, this.decimals);
    }

    get formattedReserve() {
        return this.formatAmount(this.reserves);
    }
}

class UniswapV2PairInfo {
    constructor(pairAddress, token0, token1, totalSupply, burnedLPTokens) {
        this.name = "";
        this.pairAddress = pairAddress;
        this.token0 = token0;
        this.token1 = token1;
        this.totalSupply = totalSupply;
        this.burnedLPTokens = burnedLPTokens;
        this.name = this.pairName;
    }

    get pairName() {
        return `${this.token0.symbol}-${this.token1.symbol}`;
    }

    get burnedPercentage() {
        return Number(this.burnedLPTokens * 10000n / this.totalSupply) / 100;
    }

    get circulatingLPTokens() {
        return this.totalSupply - this.burnedLPTokens;
    }

    getBurnedTokenAmount(token) {
        return token.reserves * this.burnedLPTokens / this.totalSupply;
    }
    // Pair: ${this.pairName}
    // Pair Address: ${this.pairAddress}
    
    toString() {
        return `
Total Supply of LP Tokens: ${ethers.formatEther(this.totalSupply)}
Burned (Locked) LP Tokens: ${ethers.formatEther(this.burnedLPTokens)}
Circulating LP Tokens: ${ethers.formatEther(this.circulatingLPTokens)}
Percentage of LP Tokens Burned: ${this.burnedPercentage.toFixed(2)}%
Burned ${this.token0.symbol}: ${this.token0.formatAmount(this.getBurnedTokenAmount(this.token0))}
Burned ${this.token1.symbol}: ${this.token1.formatAmount(this.getBurnedTokenAmount(this.token1))}
Current ${this.token0.symbol} Reserve: ${this.token0.formattedReserve}
Current ${this.token1.symbol} Reserve: ${this.token1.formattedReserve}
        `;
    }
}

let provider;
let pairContract;
let pairInfo;

function setupProvider() {
  provider = new ethers.WebSocketProvider(WS_NODE_PROVIDER_URL);
  pairContract = new ethers.Contract(UNISWAP_V2_PAIR_ADDRESS, PAIR_ABI, provider);
}

const UNISWAP_V2_BURN_ADDRESS = '0x000000000000000000000000000000000000dead';

async function initializePairInfo() {
  const [
    token0Address,
    token1Address,
    totalSupply,
    reserves,
    burnedLPTokens
  ] = await Promise.all([
    pairContract.token0(),
    pairContract.token1(),
    pairContract.totalSupply(),
    pairContract.getReserves(),
    pairContract.balanceOf(UNISWAP_V2_BURN_ADDRESS)
  ]);

  const [token0Info, token1Info] = await Promise.all([
    getTokenInfo(token0Address),
    getTokenInfo(token1Address),
  ]);

  const token0 = new Token(token0Address, token0Info.symbol, token0Info.decimals, reserves[0]);
  const token1 = new Token(token1Address, token1Info.symbol, token1Info.decimals, reserves[1]);

  pairInfo = new UniswapV2PairInfo(UNISWAP_V2_PAIR_ADDRESS, token0, token1, totalSupply, burnedLPTokens);
  console.log(pairInfo);
  console.log(pairInfo.toString());

  // Additional information
  console.log(`\nAdditional Information:`);
  console.log(`Total Value Locked (TVL):`);
  console.log(`  ${token0.symbol}: ${ethers.formatUnits(token0.reserves, token0.decimals)}`);
  console.log(`  ${token1.symbol}: ${ethers.formatUnits(token1.reserves, token1.decimals)}`);
  
  const circulatingSupply = totalSupply - burnedLPTokens;
  console.log(`\nCirculating Supply of LP Tokens: ${ethers.formatEther(circulatingSupply)}`);
  
  const token0Price = Number(ethers.formatUnits(token1.reserves, token1.decimals)) / 
                      Number(ethers.formatUnits(token0.reserves, token0.decimals));
  const token1Price = 1 / token0Price;
  
  console.log(`\nCurrent Prices:`);
  console.log(`  1 ${token0.symbol} = ${token0Price.toFixed(6)} ${token1.symbol}`);
  console.log(`  1 ${token1.symbol} = ${token1Price.toFixed(6)} ${token0.symbol}`);
}

async function getTokenInfo(tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [decimals, symbol] = await Promise.all([
    tokenContract.decimals(),
    tokenContract.symbol(),
  ]);
  return { decimals, symbol };
}

function formatTokenRatio(token0Symbol, token0Amount, token1Symbol, token1Amount) {
  const token1PerToken0 = token1Amount / token0Amount;
  const token0PerToken1 = token0Amount / token1Amount;
  const formattedToken0PerToken1 = token0PerToken1.toFixed(7);
  const formattedToken1PerToken0 = token1PerToken0.toFixed(7);
  return `1 ${token1Symbol} ≈ ${formattedToken0PerToken1} ${token0Symbol}, 1 ${token0Symbol} ≈ ${formattedToken1PerToken0} ${token1Symbol}`;
}

function padString(str, length, align = "left") {
  return align === "right" ? str.padStart(length) : str.padEnd(length);
}

async function subscribeToSwapEvents() {
  try {
    console.log(`Listening for Swaps at ${UNISWAP_V2_PAIR_ADDRESS}`);

    const headers = [
      "TIME",
      "TYPE",
      pairInfo.token0.symbol,
      pairInfo.token1.symbol,
      "RATIO",
    ];
    const columnWidths = [10, 12, 25, 25, 25, 25];

    console.log(
      headers
        .map((header, index) =>
          padString(header, columnWidths[index], index > 1 ? "right" : "left")
        )
        .join("")
    );

    pairContract.on(
      "Swap",
      async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
        try {
          const block = await event.getBlock();
          const date = moment(block.timestamp * 1000);

          const amount0InBN = BigInt(amount0In);
          const amount1InBN = BigInt(amount1In);
          const amount0OutBN = BigInt(amount0Out);
          const amount1OutBN = BigInt(amount1Out);

          let swapType, colorCode;
          if (amount1InBN > 0n && amount0OutBN > 0n) {
            colorCode = (PRIMARY_TOKEN_SYMBOL === pairInfo.token0.symbol) ? GREEN : RED;
            swapType = `${colorCode}${pairInfo.token1.symbol}->${pairInfo.token0.symbol}${RESET}`;
          } else if (amount0InBN > 0n && amount1OutBN > 0n) {
            colorCode = (PRIMARY_TOKEN_SYMBOL === pairInfo.token1.symbol) ? GREEN : RED;
            swapType = `${colorCode}${pairInfo.token0.symbol}->${pairInfo.token1.symbol}${RESET}`;
          }

          let token0Amount, token1Amount;
          if (amount0InBN > amount0OutBN) {
            token0Amount = Number(ethers.formatUnits(amount0InBN - amount0OutBN, pairInfo.token0.decimals));
            token1Amount = Number(ethers.formatUnits(amount1OutBN - amount1InBN, pairInfo.token1.decimals));
          } else {
            token0Amount = Number(ethers.formatUnits(amount0OutBN - amount0InBN, pairInfo.token0.decimals));
            token1Amount = Number(ethers.formatUnits(amount1InBN - amount1OutBN, pairInfo.token1.decimals));
          }

          const ratios = formatTokenRatio(
            pairInfo.token0.symbol,
            token0Amount,
            pairInfo.token1.symbol,
            token1Amount
          );

          const row = [
            padString(`${date.format("HH:mm:ss")}`, columnWidths[0]),
            padString(swapType, columnWidths[1] + 9),
            padString(token0Amount.toFixed(6), columnWidths[2], "right"),
            padString(token1Amount.toFixed(6), columnWidths[3], "right"),
            padString("  " + ratios, columnWidths[4], "left"),
          ];

          console.log(row.join(""));

          // Update reserves
          pairInfo.token0.reserves += amount0InBN - amount0OutBN;
          pairInfo.token1.reserves += amount1InBN - amount1OutBN;
        } catch (error) {
          console.error("Error processing swap event:", error);
        }
      }
    );
  } catch (error) {
    console.error("Error in subscribeToSwapEvents:", error);
    console.log("Attempting to reconnect in 5 seconds...");
    setTimeout(subscribeToSwapEvents, 5000);
  }
}

async function startMonitoring() {
  setupProvider();
  await initializePairInfo();
  await subscribeToSwapEvents();
}

startMonitoring().catch((error) => {
  console.error("Error in startMonitoring:", error);
  console.log("Attempting to restart monitoring in 5 seconds...");
  setTimeout(startMonitoring, 5000);
});