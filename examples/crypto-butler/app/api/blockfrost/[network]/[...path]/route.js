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

export async function POST(req) {
  try {
    const { token } = await req.json();
    
    const res = await fetch('https://api.utxos.dev/v1/wallet/cardano/address', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-project-id': process.env.UTXOS_PROJECT_ID,
      }
    });

    const data = await res.json();
    return Response.json({ address: data.address, balance: data.balance });

  } catch (err) {
    console.error('Wallet error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
