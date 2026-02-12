import { IBitcoinProvider } from "@meshsdk/bitcoin";
import { IFetcher } from "@meshsdk/common";
import { decryptWithCipher } from "../crypto";
import { combineShardsBuildWallet } from "../key-shard";

export async function clientDeriveWallet(
  encryptedKeyShard: string,
  deviceShardEncryptionKey: CryptoKey,
  custodialShard: string,
  networkId: 0 | 1,
  bitcoinProvider?: IBitcoinProvider,
  fetcher?: IFetcher,
) {
  const keyShare1 = await decryptWithCipher({
    encryptedDataJSON: encryptedKeyShard,
    key: deviceShardEncryptionKey,
  });
  const keyShare2 = custodialShard;

  const { bitcoinWallet, cardanoWallet, sparkWallet, key } =
    await combineShardsBuildWallet(
      networkId,
      keyShare1,
      keyShare2,
      bitcoinProvider,
      fetcher,
    );

  return { bitcoinWallet, cardanoWallet, sparkWallet, key };
}
