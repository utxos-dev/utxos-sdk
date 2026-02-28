// app/api/butler/route.js
// Multi-agent swarm: Researcher → Risk Agent → CFO Agent

import Anthropic from '@anthropic-ai/sdk';

console.log('KEY:', process.env.ANTHROPIC_API_KEY?.slice(0, 10));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── LIVE YIELD DATA from DeFiLlama ──────────────────────────────
async function fetchYields() {
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 300 }, // cache 5 min
    });
    const data = await res.json();

    // Filter for stablecoin pools on Cardano + major chains, good liquidity
    const pools = data.data
      .filter(p =>
        p.stablecoin &&
        p.tvlUsd > 1_000_000 &&
        p.apy > 0 &&
        p.apy < 100 && // filter insane APYs
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
        category: categorize(p.apy),
      }));

    return pools;
  } catch (err) {
    console.error('DeFiLlama fetch failed, using fallback:', err);
    return FALLBACK_YIELDS;
  }
}

function categorize(apy) {
  if (apy < 5) return 'conservative';
  if (apy < 12) return 'moderate';
  return 'aggressive';
}

// ── AGENT 1: RESEARCHER ─────────────────────────────────────────
async function researcherAgent(yields) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are a DeFi yield researcher. Analyze yield opportunities and return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `Analyze these yield pools and identify the top 6 opportunities across risk categories.
      
Pools: ${JSON.stringify(yields, null, 2)}

Return ONLY this JSON structure:
{
  "conservative": [{"protocol": "", "pool": "", "chain": "", "apy": 0, "reasoning": ""}],
  "moderate": [{"protocol": "", "pool": "", "chain": "", "apy": 0, "reasoning": ""}],
  "aggressive": [{"protocol": "", "pool": "", "chain": "", "apy": 0, "reasoning": ""}]
}`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── AGENT 2: RISK AGENT ─────────────────────────────────────────
async function riskAgent(userGoal, researcherOutput) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are a risk analyst for DeFi portfolios. Return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `User goal: "${userGoal}"

Available opportunities: ${JSON.stringify(researcherOutput, null, 2)}

Extract the user's:
1. Risk tolerance (conservative/moderate/aggressive)
2. Time horizon in months
3. Target amount in USD
4. Primary goal (grow/preserve/income)

Then score each opportunity 1-10 for fit.

Return ONLY this JSON:
{
  "riskProfile": {
    "tolerance": "moderate",
    "timeHorizonMonths": 12,
    "targetAmountUsd": 5000,
    "primaryGoal": "grow"
  },
  "scoredOpportunities": [
    {"protocol": "", "pool": "", "chain": "", "apy": 0, "fitScore": 8, "rationale": ""}
  ]
}`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── AGENT 3: CFO AGENT ──────────────────────────────────────────
async function cfoAgent(userGoal, riskOutput) {
  const { riskProfile, scoredOpportunities } = riskOutput;
  const amount = riskProfile.targetAmountUsd;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `You are a personal CFO and DeFi wealth manager. You explain complex finance simply, like a trusted friend who happens to be an expert. Preferred stablecoins on Cardano are iUSD, DJED, and USDM instead of USDC. Return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `User goal: "${userGoal}"
Risk profile: ${JSON.stringify(riskProfile)}
Top opportunities (scored): ${JSON.stringify(scoredOpportunities.slice(0, 6))}

Build an optimal portfolio allocation for $${amount}.

Return ONLY this JSON:
{
  "greeting": "A warm 1-sentence greeting addressing their specific goal",
  "summary": "2-3 sentence plain-English explanation of the strategy",
  "allocation": [
    {
      "protocol": "",
      "pool": "",
      "chain": "",
      "apy": 0,
      "percentage": 40,
      "amountUsd": 2000,
      "role": "Core yield engine",
      "reasoning": "Why this fits their goal"
    }
  ],
  "projections": {
    "months3": 0,
    "months6": 0,
    "months12": 0,
    "blendedApy": 0
  },
  "risks": ["Risk 1", "Risk 2"],
  "nextSteps": "One clear action sentence",
  "butlerNote": "A charming, butler-style closing remark"
}`
    }]
  });

  const text = res.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── MAIN ROUTE ──────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400 });
    }

    // Stream agent status updates via a simple object
    const agentLog = [];

    // Step 1: Fetch live yields
    agentLog.push({ agent: 'researcher', status: 'fetching live yields from DeFiLlama...' });
    const yields = await fetchYields();

    // Step 2: Researcher agent analyzes yields
    agentLog.push({ agent: 'researcher', status: 'analyzing 20+ yield opportunities...' });
    const researcherOutput = await researcherAgent(yields);

    // Step 3: Risk agent scores against user goal
    agentLog.push({ agent: 'risk', status: 'profiling your risk tolerance...' });
    const riskOutput = await riskAgent(message, researcherOutput);

    // Step 4: CFO builds the recommendation
    agentLog.push({ agent: 'cfo', status: 'building your personalized strategy...' });
    const cfoOutput = await cfoAgent(message, riskOutput);

    // Step 5: Generate testnet simulation
    const simulation = generateTestnetSimulation(cfoOutput.allocation, riskOutput.riskProfile);

    return Response.json({
      success: true,
      agentLog,
      recommendation: cfoOutput,
      riskProfile: riskOutput.riskProfile,
      simulation,
      yieldsAnalyzed: yields.length,
    });

  } catch (error) {
    console.error('Butler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ── TESTNET SIMULATION ──────────────────────────────────────────
function generateTestnetSimulation(allocation, riskProfile) {
  // Generates fake but realistic Cardano Preprod tx hashes
  const txs = allocation.map((alloc, i) => ({
    step: i + 1,
    action: `Deposit ${alloc.amountUsd.toFixed(0)} USDC → ${alloc.protocol} ${alloc.pool}`,
    protocol: alloc.protocol,
    chain: 'Cardano Preprod',
    amount: alloc.amountUsd,
    txHash: `0x${randomHex(64)}`,
    status: 'simulated',
    gasEstimate: `~$${(Math.random() * 0.05 + 0.01).toFixed(3)}`,
    explorerUrl: `https://preprod.cardanoscan.io/transaction/${randomHex(64)}`,
  }));

  return {
    network: 'Cardano Preprod Testnet',
    totalTransactions: txs.length,
    totalGasEstimate: `~$${(txs.length * 0.02).toFixed(3)}`,
    transactions: txs,
    disclaimer: 'Simulated on Cardano Preprod testnet. No real funds used.',
  };
}

function randomHex(len) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// ── FALLBACK YIELDS (if DeFiLlama is down) ─────────────────────
const FALLBACK_YIELDS = [
  { protocol: 'liqwid', pool: 'USDC', chain: 'Cardano', apy: 7.2, tvlUsd: 45_000_000, category: 'moderate' },
  { protocol: 'minswap', pool: 'ADA/USDC', chain: 'Cardano', apy: 9.1, tvlUsd: 22_000_000, category: 'moderate' },
  { protocol: 'indigo', pool: 'iUSD', chain: 'Cardano', apy: 5.8, tvlUsd: 18_000_000, category: 'conservative' },
  { protocol: 'splash', pool: 'USDC', chain: 'Cardano', apy: 8.4, tvlUsd: 15_000_000, category: 'moderate' },
  { protocol: 'wingriders', pool: 'USDC', chain: 'Cardano', apy: 6.5, tvlUsd: 12_000_000, category: 'moderate' },
  { protocol: 'sundae', pool: 'USDC', chain: 'Cardano', apy: 7.8, tvlUsd: 10_000_000, category: 'moderate' },
];
