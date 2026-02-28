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
