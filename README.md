# UniswapV2Pairs

## Setting Up
### 1. Clone/Download the Repository

### 2. Install Dependencies:
`npm install`

### 3. Create and Setup .env
Before running any scripts, you'll want to create a .env file with the following values (see .env.example):
- **PROVIDER_URL=""**

- **wss://mainnet.infura.io/ws/v3/<API-KEY>**
- **wss://base-mainnet.g.alchemy.com/v2/<API-KEY>**
- **wss://arb-mainnet.g.alchemy.com/v2/<API-KEY>**
- **wss://optimism-mainnet.infura.io/v3/API-KEY**
- **wss://bsc-mainnet.infura.io/ws/v3/API-KEY**
- **https://mainnet.infura.io/v3/<API-KEY>**
- **https://arbitrum-mainnet.infura.io/v3/<API-KEY>**
- **https://base-mainnet.infura.io/v3/<API-KEY>**
- **https://base-mainnet.g.alchemy.com/v2/<API-KEY>**
- **https://arb-mainnet.g.alchemy.com/v2/<API-KEY>**

### 4. Configure token pair in config.json
- **WETH/USDC 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc**
- **DOGE/WETH 0x308C6fbD6a14881Af333649f17f2FdE9cd75e2a6**
- **CATE/WETH 0x68d66f784b49c2F3acF80E549cde65C81A0a1E12**

- **RIXEN/WETH 0x4D4709345A1F95ADEa9FE3e1e340ED68d8F2792f (Base)**
- **BRETT/WETH 0x404E927b203375779a6aBD52A2049cE0ADf6609B (Base)**

- **LGNS/DAI 0x882df4B0fB50a229C3B4124EB18c759911485bFb (Polygon)**
0x588d7cf062f4eDD7c7c7f2d66FD770e03b1eA735
- **CAT/WBNB 0x6DF9aDc1837Bf37E0B1b943d59A7E50D9678c81B (BSC)**
- **WBNB/MAO 0xaEf1ea768cF7c227f405298aA86EA84786941c63 (BSC)**
- **Kisar/USDT 0x80709fD0e67e62CCccEaB855d66A552cA75CB30b (BSC)**


### 5. Start monitoring pair swaps
Run the following command to begin monitoring
`node monitors.js`