# Crypto Butler

An AI-powered DeFi wealth management agent built on Cardano. Users describe their financial goals in plain English and a multi-agent AI swarm analyzes live yield opportunities, builds a personalized strategy, and simulates execution on Cardano Preprod testnet.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Multi-Agent System](#multi-agent-system)
- [UTXOS.dev Integration](#utxosdev-integration)
- [Wallet Connection](#wallet-connection)
- [Yield Data](#yield-data)
- [Testnet Simulation](#testnet-simulation)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Open Source Contributions](#open-source-contributions)
- [Roadmap](#roadmap)

---

## Overview

Crypto Butler is a conversational DeFi agent. Instead of navigating complex protocol interfaces, users simply describe what they want:

> "Grow my 5000 USDC at moderate risk over 12 months"

The system deploys three specialized AI agents that research live yields, profile risk tolerance, and return a plain-English allocation strategy with projected returns — all simulated on Cardano Preprod testnet.

The product targets two audiences:
- Crypto-native users who want intelligent yield optimization without manual research
- Emerging market users (starting with Kenya) who need a simple, mobile-first entry point into DeFi with M-Pesa integration planned for a future release

---

## Architecture
```
User Input (natural language goal)
          |
          v
  Orchestrator (Next.js API Route)
          |
    +-----+-----+
    |     |     |
    v     v     v
Research Risk  CFO
Agent   Agent  Agent
    |     |     |
    +-----+-----+
          |
          v
   Recommendation
   (allocation + projections)
          |
          v
  Testnet Simulation
  (Cardano Preprod)
          |
          v
    UI Dashboard
    (charts + tx log)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| AI Agents | Anthropic Claude claude-sonnet-4-20250514 |
| Wallet (Social) | UTXOS.dev Wallet-as-a-Service |
| Wallet (Native) | CIP-30 direct browser API |
| Yield Data | DeFiLlama API |
| Blockchain | Cardano Preprod Testnet |
| Blockchain Data | Blockfrost |
| Charts | Recharts |
| Deployment | Vercel |

---

## Multi-Agent System

The core of Crypto Butler is a three-agent swarm. Each agent has a single responsibility and passes structured JSON to the next.

### Agent 1: Researcher

Fetches live yield data from DeFiLlama and identifies the top opportunities across risk categories.
```javascript
// app/api/butler/route.js

async function researcherAgent(yields) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a DeFi yield researcher. 
             Analyze yield opportunities and return ONLY valid JSON.`,
    messages: [{
      role: 'user',
      content: `Analyze these yield pools and identify the top 6 
                opportunities across risk categories.
      
      Pools: ${JSON.stringify(yields, null, 2)}

      Return ONLY this JSON structure:
      {
        "conservative": [{"protocol": "", "pool": "", "chain": "", 
                          "apy": 0, "reasoning": ""}],
        "moderate":     [{"protocol": "", "pool": "", "chain": "", 
                          "apy": 0, "reasoning": ""}],
        "aggressive":   [{"protocol": "", "pool": "", "chain": "", 
                          "apy": 0, "reasoning": ""}]
      }`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}
```

### Agent 2: Risk Analyst

Parses the user's natural language goal to extract risk tolerance, time horizon, and target amount. Scores each opportunity for fit.
```javascript
async function riskAgent(userGoal, researcherOutput) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are a risk analyst for DeFi portfolios. 
             Return ONLY valid JSON.`,
    messages: [{
      role: 'user',
      content: `User goal: "${userGoal}"
      Available opportunities: ${JSON.stringify(researcherOutput)}

      Extract:
      1. Risk tolerance (conservative/moderate/aggressive)
      2. Time horizon in months
      3. Target amount in USD
      4. Primary goal (grow/preserve/income)

      Score each opportunity 1-10 for fit.

      Return ONLY this JSON:
      {
        "riskProfile": {
          "tolerance": "moderate",
          "timeHorizonMonths": 12,
          "targetAmountUsd": 5000,
          "primaryGoal": "grow"
        },
        "scoredOpportunities": [
          {
            "protocol": "",
            "pool": "",
            "apy": 0,
            "fitScore": 8,
            "rationale": ""
          }
        ]
      }`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}
```

### Agent 3: CFO

Takes the scored opportunities and builds a complete portfolio allocation with projections, risks, and plain-English explanation.
```javascript
async function cfoAgent(userGoal, riskOutput) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `You are a personal CFO and DeFi wealth manager. 
             Explain complex finance simply. Return ONLY valid JSON.`,
    messages: [{
      role: 'user',
      content: `User goal: "${userGoal}"
      Risk profile: ${JSON.stringify(riskOutput.riskProfile)}
      Top opportunities: ${JSON.stringify(riskOutput.scoredOpportunities)}

      Return ONLY this JSON:
      {
        "greeting": "",
        "summary": "",
        "allocation": [
          {
            "protocol": "",
            "pool": "",
            "chain": "",
            "apy": 0,
            "percentage": 40,
            "amountUsd": 2000,
            "role": "Core yield engine",
            "reasoning": ""
          }
        ],
        "projections": {
          "months3": 0,
          "months6": 0,
          "months12": 0,
          "blendedApy": 0
        },
        "risks": [],
        "butlerNote": ""
      }`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}
```

---

## UTXOS.dev Integration

Crypto Butler uses UTXOS.dev to enable social login wallet creation. This removes the requirement for users to have an existing Cardano wallet or browser extension — critical for the emerging market use case.

### The Problem It Solves

Standard Cardano wallet onboarding requires:
- Installing a browser extension
- Writing down a 24-word seed phrase
- Funding the wallet manually

For a first-time user in Nairobi, this is a fatal barrier. UTXOS.dev replaces it with a Google or Apple login.

### How It Is Integrated

All UTXOS SDK calls run server-side in a Next.js API route. This avoids the WebAssembly SSR conflict that occurs when Cardano SDKs are imported in client components.
```javascript
// app/api/wallet/enable/route.js

import { Web3Wallet } from '@utxos/sdk';
import { BlockfrostProvider } from '@meshsdk/core';

export async function POST(req) {
  try {
    const provider = new BlockfrostProvider('/api/blockfrost/preprod/');

    const wallet = await Web3Wallet.enable({
      projectId: process.env.UTXOS_PROJECT_ID,
      networkId: 0, // 0 = preprod, 1 = mainnet
      fetcher: provider,
      submitter: provider,
    });

    const address = await wallet.cardano.getChangeAddress();
    const balance = await wallet.cardano.getBalance();

    return Response.json({ address, balance });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
```

The Blockfrost API key is kept server-side via a proxy route:
```javascript
// app/api/blockfrost/[network]/[...path]/route.js

export async function GET(req, { params }) {
  const { network, path } = params;
  
  const apiKey = network === 'preprod'
    ? process.env.BLOCKFROST_API_KEY_PREPROD
    : process.env.BLOCKFROST_API_KEY_MAINNET;

  const url = `https://cardano-${network}.blockfrost.io/api/v0/${path.join('/')}`;

  const res = await fetch(url, {
    headers: { project_id: apiKey }
  });

  const data = await res.json();
  return Response.json(data);
}
```

### Why Server-Side
```
Browser                        Server (API Route)
  |                                |
  | POST /api/wallet/enable        |
  |------------------------------> |
  |                                | UTXOS SDK runs here
  |                                | Blockfrost called here
  |                                | WebAssembly runs here
  | { address, balance }           |
  | <-----------------------------|
  |                                |
No SDK in browser              No SSR conflict
```

---

## Wallet Connection

The app supports two wallet connection methods side by side.

### Method 1: Social Login via UTXOS.dev

For new users with no existing Cardano wallet. Login with Google or Apple creates a non-custodial wallet automatically. No seed phrase. No browser extension.
```javascript
// components/WalletConnect.jsx

async function connectSocial(provider) {
  try {
    const res = await fetch('/api/wallet/enable', { method: 'POST' });
    const { address, balance } = await res.json();
    setAddress(address.slice(0, 8) + '...' + address.slice(-4));
    setConnected(true);
    onConnected?.({ address, balance }, 'social');
  } catch (err) {
    console.error('Social login failed:', err);
  }
}
```

### Method 2: CIP-30 Native Wallet

For existing Cardano users with Eternl, Nami, Vespr, or other CIP-30 compatible wallets. Uses the standard `window.cardano` browser API directly — no SDK required.
```javascript
// components/WalletConnect.jsx

useEffect(() => {
  if (typeof window === 'undefined') return;
  const knownWallets = ['eternl', 'nami', 'vespr', 'flint', 'typhon'];
  const detected = knownWallets
    .filter(name => window.cardano?.[name])
    .map(name => ({
      name,
      icon: window.cardano[name].icon,
      api: window.cardano[name]
    }));
  setWallets(detected);
}, []);

async function connectWallet(wallet) {
  const api = await wallet.api.enable();
  const addresses = await api.getUsedAddresses();
  const addr = addresses[0];
  setAddress(addr.slice(0, 8) + '...' + addr.slice(-4));
  setConnected(true);
  onConnected?.(api, 'cip30');
}
```

---

## Yield Data

Live yield data is fetched from the DeFiLlama Pools API at request time. No API key required.
```javascript
// app/api/butler/route.js

async function fetchYields() {
  const res = await fetch('https://yields.llama.fi/pools', {
    next: { revalidate: 300 }, // cache for 5 minutes
  });
  const data = await res.json();

  return data.data
    .filter(p =>
      p.stablecoin &&
      p.tvlUsd > 1_000_000 &&
      p.apy > 0 &&
      p.apy < 100 &&
      ['Cardano', 'Ethereum', 'Arbitrum'].includes(p.chain)
    )
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 20)
    .map(p => ({
      protocol: p.project,
      pool: p.symbol,
      chain: p.chain,
      apy: parseFloat(p.apy.toFixed(2)),
      tvlUsd: p.tvlUsd,
    }));
}
```

Cardano-native protocols included in the filter: Liqwid, Minswap, Indigo, Splash.

---

## Testnet Simulation

After the CFO agent builds an allocation, the system generates a simulated set of Cardano Preprod transactions. Each transaction represents one deposit step in the strategy.
```javascript
function generateTestnetSimulation(allocation) {
  return {
    network: 'Cardano Preprod Testnet',
    transactions: allocation.map((alloc, i) => ({
      step: i + 1,
      action: `Deposit ${alloc.amountUsd.toFixed(0)} USDC 
               into ${alloc.protocol} ${alloc.pool}`,
      protocol: alloc.protocol,
      chain: 'Cardano Preprod',
      amount: alloc.amountUsd,
      txHash: generateMockTxHash(),
      status: 'simulated',
      explorerUrl: `https://preprod.cardanoscan.io/transaction/${generateMockTxHash()}`,
    })),
    disclaimer: 'Simulated on Cardano Preprod testnet. No real funds used.',
  };
}
```

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- An Anthropic API key
- A UTXOS.dev project ID
- A Blockfrost API key (Preprod)
- Eternl wallet browser extension (for CIP-30 testing)

### Installation
```bash
git clone https://github.com/your-username/crypto-butler
cd crypto-butler
npm install
cp .env.example .env.local
```

Fill in your environment variables then run:
```bash
npm run dev
```

Open http://localhost:3000 and type a goal such as:
```
Grow my 5000 USDC at moderate risk over 12 months
```

---

## Environment Variables
```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# UTXOS.dev
UTXOS_PROJECT_ID=your_project_id

# Blockfrost
BLOCKFROST_API_KEY_PREPROD=preprodxxxxxxxx
BLOCKFROST_API_KEY_MAINNET=mainnetxxxxxxxx

# WalletConnect (optional for CIP-30)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

---

## Project Structure
```
crypto-butler/
  app/
    api/
      butler/
        route.js          - Multi-agent orchestration
      wallet/
        enable/
          route.js        - UTXOS.dev wallet initialization
      blockfrost/
        [network]/
          [...path]/
            route.js      - Blockfrost proxy
    globals.css
    layout.jsx
    page.jsx              - Main chat interface
    providers.jsx
  components/
    AgentPanel.jsx        - Live agent activity display
    Charts.jsx            - Allocation pie + projection chart
    SimulationPanel.jsx   - Testnet transaction log
    WalletConnect.jsx     - Dual wallet connection UI
  .env.example
  next.config.js
  README.md
```

---

## Open Source Contributions

During development we encountered a critical incompatibility between Mesh SDK and Next.js 15. Mesh SDK's dependency on `libsodium-wrappers-sumo` (WebAssembly cryptography) causes build failures when imported in any client component, even with `ssr: false` and dynamic imports.

The root cause is that Next.js 15 with Turbopack attempts to bundle WebAssembly modules server-side during the compilation step, before the `ssr: false` directive can take effect.

Our solution was to move all Cardano SDK usage to server-side API routes where WebAssembly runs without conflict, and implement a direct CIP-30 wallet connection for the client that requires zero SDK dependencies.

We have documented this issue and the fix in a pull request to the MeshJS repository at github.com/MeshJS/mesh.

---

## Roadmap

**Post-Hackathon Phase 1**
- M-Pesa onramp and offramp integration (Kenya)
- Real transaction execution on Cardano mainnet
- Performance fee smart contract (10-20% of yield)

**Phase 2**
- Autonomous rebalancing agent
- Multi-chain expansion (Base, Solana)
- Mobile application

**Phase 3**
- TEE-based key management
- DAO governance for strategy parameters
- Expansion to Nigeria, Ghana, Tanzania
