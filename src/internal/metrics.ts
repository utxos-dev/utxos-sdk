import { AxiosInstance } from "axios";

/**
 * Tracks a transaction metric specifically for developer-controlled wallets.
 * Internal SDK helper used by DCW functions.
 */
export async function trackDeveloperTransaction(
  axiosInstance: AxiosInstance,
  network: "mainnet" | "testnet",
  blockchain: "cardano" | "bitcoin" | "spark",
  type: string = "tx-submit"
) {
  try {
    const yearMonth = new Date().toISOString().slice(0, 7);
    await axiosInstance.post("api/metrics/tx", {
      walletType: "developer",
      blockchain,
      network: network,
      type,
      yearMonth,
    });
  } catch (error) {
    // Silent fail - tracing shouldn't break the SDK
  }
}

/**
 * Tracks a platform-level metric.
 * Internal SDK helper for platform-wide analytics.
 */
export async function trackPlatformMetric(
  axiosInstance: AxiosInstance,
  metricType:
    | "mau"
    | "new-wallets"
    | "active-projects"
    | "new-projects",
  count: number = 1
) {
  try {
    await axiosInstance.post("api/metrics/platform", {
      metricType,
      count,
    });
  } catch (error) {
    // Silent fail
  }
}

