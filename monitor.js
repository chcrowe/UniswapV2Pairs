const ethers = require("ethers");
const moment = require("moment-timezone");
const config = require("./config.json");
require("dotenv").config();

const WS_NODE_PROVIDER_URL = `${process.env.WS_NODE_PROVIDER_URL}`;
// Specific Uniswap V2 pair address (e.g., WETH-USDC pair)
const UNISWAP_V2_PAIR_ADDRESS = config.UNISWAP_V2_PAIR_ADDRESS;
const PRIMARY_TOKEN_SYMBOL = config.PRIMARY_TOKEN_SYMBOL;

// Subset ABI for the Uniswap V2 Pair
const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function name() external view returns (string)",
];

// ERC20 ABI (for getting token decimals)
const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

let provider;
let pairContract;

function setupProvider() {
  provider = new ethers.WebSocketProvider(WS_NODE_PROVIDER_URL);
  pairContract = new ethers.Contract(
    UNISWAP_V2_PAIR_ADDRESS,
    PAIR_ABI,
    provider
  );
  
  console.log("provider: ", provider);  
  return;
  provider._websocket.on("close", async (code) => {
    console.log(
      `WebSocket connection closed. Code: ${code}. Attempting reconnect in 5 seconds...`
    );
    setTimeout(setupProvider, 5000);
  });
}

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// Helper function to format number with commas and specific decimal places
function formatNumber(number, decimalPlaces) {
  return Number(number).toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

// Function to get token decimals and symbol
async function getTokenInfo(tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [decimals, symbol] = await Promise.all([
    tokenContract.decimals(),
    tokenContract.symbol(),
  ]);
  return { decimals, symbol };
}

// Helper function to pad string (left or right align)
function padString(str, length, align = "left") {
  if (align === "right") {
    return str.padStart(length);
  }
  return str.padEnd(length);
}

function formatTokenRatio(
  token0Symbol,
  token0Amount,
  token1Symbol,
  token1Amount
) {
  // Calculate ratios
  const token1PerToken0 = token1Amount / token0Amount;
  const token0PerToken1 = token0Amount / token1Amount;

  // Format numbers
  const formattedToken0PerToken1 = token0PerToken1.toFixed(7);
  const formattedToken1PerToken0 = token1PerToken0.toFixed(7);

  // Construct and return the formatted string
  return `1 ${token1Symbol} ≈ ${formattedToken0PerToken1} ${token0Symbol}, 1 ${token0Symbol} ≈ ${formattedToken1PerToken0} ${token1Symbol}`;
}

// Function to subscribe to Swap events for the specific pair
async function subscribeToSwapEvents() {
  try {
    let contractType = await pairContract.name();
    console.log(
      `Listening for ${contractType} Swaps at ${UNISWAP_V2_PAIR_ADDRESS}`
    );

    const [token0, token1] = await Promise.all([
      pairContract.token0(),
      pairContract.token1(),
    ]);
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(token0),
      getTokenInfo(token1),
    ]);

    let token0PrimaryFlag = (PRIMARY_TOKEN_SYMBOL == token0Info.symbol) ? `${YELLOW}(Primary)${RESET}` : "";
    let token1PrimaryFlag = (PRIMARY_TOKEN_SYMBOL == token1Info.symbol) ? `${YELLOW}(Primary)${RESET}` : "";
    
    console.log("token0: ", token0, token0Info, token0PrimaryFlag);
    console.log("token1: ", token1, token1Info, token1PrimaryFlag);

    // Print the table header
    const headers = [
      "TIME",
      "TYPE",
      token0Info.symbol,
      token1Info.symbol,
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
      async (
        sender,
        amount0In,
        amount1In,
        amount0Out,
        amount1Out,
        to,
        event
      ) => {
        try {
          const block = await event.getBlock();
          const date = moment(block.timestamp * 1000);

          const amount0InBN = BigInt(amount0In);
          const amount1InBN = BigInt(amount1In);
          const amount0OutBN = BigInt(amount0Out);
          const amount1OutBN = BigInt(amount1Out);

          // Determine swap type based on WETH (Token1) movement
          let swapType, colorCode;

          if (amount1InBN > 0n && amount0OutBN > 0n) {
            colorCode = (PRIMARY_TOKEN_SYMBOL == token0Info.symbol) ? GREEN : RED;
            swapType = `${colorCode}${token1Info.symbol}->${token0Info.symbol}${RESET}`;
          } else if (amount0InBN > 0n && amount1OutBN > 0n) {
            colorCode = (PRIMARY_TOKEN_SYMBOL == token1Info.symbol) ? GREEN : RED;
            swapType = `${colorCode}${token0Info.symbol}->${token1Info.symbol}${RESET}`;
          }

          let token0Amount, token1Amount;
          if (amount0InBN > amount0OutBN) {
            token0Amount = Number(
              ethers.formatUnits(
                amount0InBN - amount0OutBN,
                token0Info.decimals
              )
            );
            token1Amount = Number(
              ethers.formatUnits(
                amount1OutBN - amount1InBN,
                token1Info.decimals
              )
            );
          } else {
            token0Amount = Number(
              ethers.formatUnits(
                amount0OutBN - amount0InBN,
                token0Info.decimals
              )
            );
            token1Amount = Number(
              ethers.formatUnits(
                amount1InBN - amount1OutBN,
                token1Info.decimals
              )
            );
          }

          const ratioToken0_Token1 = token0Amount / token1Amount;
          const ratioToken1_Token0 = token1Amount / token0Amount;

          const ratios = formatTokenRatio(
            token0Info.symbol,
            token0Amount,
            token1Info.symbol,
            token1Amount
          );

          const row = [
            padString(`${date.format("HH:mm:ss")}`, columnWidths[0]),
            padString(swapType, columnWidths[1] + 9), // Add 9 to account for color codes
            padString(formatNumber(token0Amount, 6), columnWidths[2], "right"),
            padString(formatNumber(token1Amount, 6), columnWidths[3], "right"),
            padString("  " + ratios, columnWidths[4], "left"),
          ];

          console.log(row.join(""));
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

function startMonitoring() {
  setupProvider();
  subscribeToSwapEvents().catch((error) => {
    console.error("Error in startMonitoring:", error);
    console.log("Attempting to restart monitoring in 5 seconds...");
    setTimeout(startMonitoring, 5000);
  });
}

// Start monitoring
startMonitoring();
