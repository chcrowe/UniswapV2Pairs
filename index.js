const ethers = require("ethers");
const moment = require("moment-timezone");

// Specific Uniswap V2 pair address (e.g., WETH-USDC pair)
const UNISWAP_V2_PAIR_ADDRESS = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc";

// Simplified ABI for the Uniswap V2 Pair
const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
];

// ERC20 ABI (for getting token decimals)
const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// Connect to an Ethereum node (replace with your own provider URL)
const provider = new ethers.JsonRpcProvider(
  "https://mainnet.infura.io/v3/YOUR-API-CODE"
);

// Create a contract instance for the specific Uniswap V2 pair
const pairContract = new ethers.Contract(
  UNISWAP_V2_PAIR_ADDRESS,
  PAIR_ABI,
  provider
);

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

// Helper function to format number with commas and specific decimal places
function formatNumber(number, decimalPlaces) {
  return Number(number).toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

// Function to generate a random maker address (placeholder)
function generateMakerAddress() {
  const hex = "0123456789abcdef";
  return (
    "0x" +
    Array(40)
      .fill(0)
      .map(() => hex[Math.floor(Math.random() * 16)])
      .join("")
  );
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

// Function to subscribe to Swap events for the specific pair
async function subscribeToSwapEvents() {
  console.log(`Listening for Swap events on pair: ${UNISWAP_V2_PAIR_ADDRESS}`);

  const [token0, token1] = await Promise.all([
    pairContract.token0(),
    pairContract.token1(),
  ]);
  const [token0Info, token1Info] = await Promise.all([
    getTokenInfo(token0),
    getTokenInfo(token1),
  ]);

  console.log("token0: ", token0, token0Info);
  console.log("token1: ", token1, token1Info);

  // Print the table header
  const headers = ["DATE", "TYPE", "USD", "WETH", "USDC", "PRICE", "MAKER"];
  const columnWidths = [12, 8, 15, 15, 15, 15, 20];
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

        // Determine swap type based on WETH (Token1) movement
        const swapType = amount1InBN > 0n ? "Sell" : "Buy";

        let usdcQuantity, wethQuantity;
        if (swapType === "Buy") {
          usdcQuantity = amount0InBN - amount0OutBN;
          wethQuantity = amount1OutBN - amount1InBN;
        } else {
          // Sell
          usdcQuantity = amount0OutBN - amount0InBN;
          wethQuantity = amount1InBN - amount1OutBN;
        }

        const usdcAmount = Number(
          ethers.formatUnits(usdcQuantity, token0Info.decimals)
        );
        const wethAmount = Number(
          ethers.formatUnits(wethQuantity, token1Info.decimals)
        );
        const price = usdcAmount / wethAmount;

        const makerAddress = generateMakerAddress();

        const coloredType =
          swapType === "Buy"
            ? `${GREEN}${swapType}${RESET}`
            : `${RED}${swapType}${RESET}`;

        const row = [
          padString(`${date.format('HH:mm:ss')}`, columnWidths[0]),
          padString(coloredType, columnWidths[1] + 9), // Add 9 to account for color codes
          padString(formatNumber(usdcAmount, 2), columnWidths[2], "right"),
          padString(formatNumber(wethAmount, 4), columnWidths[3], "right"),
          padString(formatNumber(usdcAmount, 2), columnWidths[4], "right"),
          padString(formatNumber(price, 2), columnWidths[5], "right"),
          padString(
            `   ${makerAddress.slice(0, 6)}...${makerAddress.slice(-4)}`,
            columnWidths[6]
          ),
        ];

        console.log(row.join(""));
      } catch (error) {
        console.error("Error processing swap event:", error);
      }
    }
  );
}

// Start subscribing to Swap events
subscribeToSwapEvents().catch(console.error);
