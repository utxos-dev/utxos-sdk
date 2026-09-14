import { Web3Sdk } from "..";
import { UTxO } from "@meshsdk/common";
import { MeshTxBuilder } from "@meshsdk/transaction";
import { meshUniversalStaticUtxo } from "../index";
import { SponsorshipTxParserPostRequestBody } from "../../types";
import { trackDeveloperTransaction } from "../../internal/metrics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SponsorshipV2Config = {
  id: string;
  projectId: string;
  projectWalletId: string;
  numUtxosTriggerPrepare: number;
  numUtxosPrepare: number;
  /** Sponsor UTxO size in ADA (e.g. 5). Multiply by 1_000_000 for lovelace. */
  utxoAmount: number;
  sponsorshipInfo: string | null;
};

type SponsorshipOutput = {
  projectWalletId: string;
  txHash: string;
  outputIndex: number;
  createdAt: Date | null;
  isPending: boolean;
  isSpent: boolean;
};

type WalletHandle = {
  wallet: any; // MeshCardanoHeadlessWallet
  address: string;
};

export type SponsorTxV2Response =
  | { success: true; data: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** UTxO stays pending for at most this long before the sweep treats it as stale */
const STALE_PENDING_AGE_MS = 60 * 60 * 1_000; // 1 hour

// ---------------------------------------------------------------------------
// Module-level in-process reservation set (process-scoped)
//
// Keyed by projectWalletId. Survives across Web3Sdk re-instantiations within
// the same Node.js process (e.g. per-request SDK instances in Next.js API routes
// share this set via the module cache). Closes the same-process concurrent-request
// race where two callers both pass dbIsReservedOrSpent before either writes to DB.
// ---------------------------------------------------------------------------

const inProcessReserved = new Map<string, Set<string>>();

function tryReserve(projectWalletId: string, ref: string): boolean {
  if (!inProcessReserved.has(projectWalletId)) {
    inProcessReserved.set(projectWalletId, new Set());
  }
  const set = inProcessReserved.get(projectWalletId)!;
  if (set.has(ref)) return false;
  set.add(ref);
  return true;
}

function release(projectWalletId: string, ref: string): void {
  inProcessReserved.get(projectWalletId)?.delete(ref);
}

// ---------------------------------------------------------------------------
// SponsorshipV2
// ---------------------------------------------------------------------------

/**
 * SponsorshipV2 — drop-in replacement for Sponsorship with all known bugs fixed.
 *
 * Fixes over V1:
 * 1. In-process concurrency guard (module-level Set) prevents same-process double-reservation.
 * 2. utxoAmount is consistently treated as ADA and converted to lovelace (× 1_000_000).
 * 3. Lexicographic ordering guard: only selects refs that sort AFTER the static placeholder.
 *    Prevents Plutus redeemer index shifts when tx-parser sorts inputs canonically.
 * 4. Fisher-Yates shuffle for fair, non-repeating UTxO iteration.
 * 5. DB reservation check tests isPending OR isSpent (V1 only tested isSpent).
 * 6. Revert path: on any failure after a DB reservation, marks the UTxO non-pending again.
 * 7. consolidate() submits the tx AND updates refreshTxHash.
 * 8. Fallback path iterates refreshTxHash indices in shuffled order (no repeat draws).
 * 9. Static wallet cache (class-level) survives SDK re-instantiation between requests.
 * 10. Background consolidation fire-and-forget with in-flight guard (one at a time).
 */
export class SponsorshipV2 {
  private readonly sdk: Web3Sdk;

  // Class-level wallet cache (persists across Web3Sdk instances in same process).
  // Key: projectWalletId. Cleared on init failure so next call retries cleanly.
  private static walletHandles = new Map<string, Promise<WalletHandle>>();

  // Per-instance consolidation lock keyed by projectWalletId.
  private consolidationInFlight = new Map<string, Promise<{ txHash: string }> | null>();

  constructor({ sdk }: { sdk: Web3Sdk }) {
    this.sdk = sdk;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Full-cycle sponsorship: fetches config, selects and reserves a sponsor UTxO,
   * rebuilds via tx-parser, signs with the sponsor wallet, returns signed hex.
   */
  async sponsorTx({
    sponsorshipId,
    tx,
  }: {
    sponsorshipId: string;
    tx: string;
  }): Promise<SponsorTxV2Response> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/sponsorship/${sponsorshipId}`,
    );
    if (status !== 200 || !data?.projectWalletId) {
      return {
        success: false,
        error: "Invalid sponsorship ID or failed to fetch config",
      };
    }
    try {
      const signedHex = await this.sponsorTxAndSign({
        txHex: tx,
        config: data as SponsorshipV2Config,
      });
      return { success: true, data: signedHex };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Sponsorship failed" };
    }
  }

  /**
   * Sponsor with a pre-fetched config — skips the per-call GET api/sponsorship/{id}.
   * Returns the signed rebuilt tx hex directly.
   * Use this from server-side handlers that cache the config at startup.
   */
  async sponsorTxAndSign({
    txHex,
    config,
  }: {
    txHex: string;
    config: SponsorshipV2Config;
  }): Promise<string> {
    const staticRef = this.getStaticRef();
    const requiredAmountStr = (config.utxoAmount * 1_000_000).toString();
    const { projectWalletId } = config;

    const { wallet, address } = await this.getOrInitWallet(projectWalletId);

    // Parallel fetch: wallet UTxOs + pending reservation set
    const [walletUtxos, pendingIds] = await Promise.all([
      wallet.getUtxosMesh() as Promise<UTxO[]>,
      this.getPendingIds(projectWalletId),
    ]);

    if (walletUtxos.length === 0) {
      throw new Error("Sponsor wallet has no UTxOs. Please fund the wallet.");
    }

    // Filter viable UTxOs (lovelace-only, correct amount, not pending, sorts after static ref)
    let viable = this.filterViable(walletUtxos, pendingIds, requiredAmountStr, staticRef);

    // Divergence recovery — runs before consolidation so stale DB state doesn't
    // trigger an unnecessary (and fee-burning) consolidation tx.
    if (viable.length === 0) {
      const { recovered } = await this.sweepDivergedState(
        projectWalletId, walletUtxos, requiredAmountStr, staticRef,
      );
      if (recovered > 0) {
        const freshPendingIds = await this.getPendingIds(projectWalletId);
        viable = this.filterViable(walletUtxos, freshPendingIds, requiredAmountStr, staticRef);
      }
    }

    // Foreground consolidation when pool is empty — blocks this request until done
    if (viable.length === 0) {
      const { txHash } = await this.consolidate({
        wallet, address, config, staticRef, requiredAmountStr,
      });
      const refreshedUtxos = await this.pollUntilRef(wallet, `${txHash}#0`);
      const freshPendingIds = await this.getPendingIds(projectWalletId);
      viable = this.filterViable(refreshedUtxos, freshPendingIds, requiredAmountStr, staticRef);
      if (viable.length === 0) {
        throw new Error("No viable sponsor UTxOs after consolidation. Check wallet balance.");
      }
    }

    // Background consolidation when pool is getting low — does not block this request
    if (viable.length <= config.numUtxosTriggerPrepare) {
      this.consolidateBackground({ wallet, address, config, staticRef, requiredAmountStr });
    }

    // Select with in-process guard + DB reservation (Fisher-Yates, no repeat picks)
    const selection = await this.selectUtxo(viable, projectWalletId);
    if (!selection) {
      throw new Error("No UTxOs could be reserved — all candidates are already in use.");
    }

    const { utxo: selectedUtxo, ref: activeRef } = selection;
    let succeeded = false;

    try {
      let rebuiltTxHex: string;
      try {
        rebuiltTxHex = await this.rebuildTx({ txHex, address, walletUtxos, selectedUtxo });
      } catch {
        // Primary failed — revert reservation, try refreshTxHash fallback pool
        release(projectWalletId, activeRef);
        await this.dbRevertPending(
          projectWalletId,
          selectedUtxo.input.txHash,
          selectedUtxo.input.outputIndex,
        ).catch(() => {});

        rebuiltTxHex = await this.tryFallback({
          config, address, walletUtxos, txHex, projectWalletId,
        });
      }

      const signed: string = await wallet.signTxReturnFullTx(rebuiltTxHex, true);
      succeeded = true;
      return signed;
    } finally {
      release(projectWalletId, activeRef);
      if (!succeeded) {
        await this.dbRevertPending(
          projectWalletId,
          selectedUtxo.input.txHash,
          selectedUtxo.input.outputIndex,
        ).catch(() => {});
      }
    }
  }

  /**
   * Manually recover diverged DB state for a project wallet.
   * Call this from an admin/recovery endpoint when UTxOs are stuck
   * pending or wrongly marked spent despite being unspent on-chain.
   *
   * Returns the number of UTxOs whose DB state was reset.
   */
  async recoverStaleState(projectWalletId: string): Promise<{ recovered: number }> {
    const { wallet } = await this.getOrInitWallet(projectWalletId);
    const walletUtxos: UTxO[] = await wallet.getUtxosMesh();
    return this.sweepDivergedState(projectWalletId, walletUtxos);
  }

  getStaticInfo(amount: "5" | "99" = "5") {
    return {
      changeAddress: meshUniversalStaticUtxo[this.sdk.network]["5"].output.address,
      utxo: meshUniversalStaticUtxo[this.sdk.network][amount],
      collateral: meshUniversalStaticUtxo[this.sdk.network]["5"],
    };
  }

  // ---------------------------------------------------------------------------
  // Divergence sweep
  // ---------------------------------------------------------------------------

  /**
   * Compares on-chain wallet UTxOs (ground truth) against DB state and resets
   * any UTxO that is confirmed unspent on-chain but wrongly locked in DB as
   * isPending=true or isSpent=true.
   *
   * Two passes:
   *   Pass 1 — pending sweep: fetch all isPending=true rows; reset any that
   *     (a) are present in walletUtxos (chain says unspent) OR
   *     (b) are older than STALE_PENDING_AGE_MS.
   *   Pass 2 — spent-divergence sweep: for each walletUtxo that would be a
   *     viable sponsor candidate, check if DB marks it isSpent=true; if so,
   *     reset it (chain is ground truth — it's in the wallet, therefore unspent).
   */
  private async sweepDivergedState(
    projectWalletId: string,
    walletUtxos: UTxO[],
    requiredAmountStr?: string,
    staticRef?: string,
  ): Promise<{ recovered: number }> {
    const walletRefSet = new Set(
      walletUtxos.map((u) => `${u.input.txHash}#${u.input.outputIndex}`),
    );
    let recovered = 0;

    // ── Pass 1: stale / chain-reverted pending entries ──────────────────────
    const { data: pendingData, status: pendingStatus } =
      await this.sdk.axiosInstance
        .get(`api/sponsorship/output/${projectWalletId}/pending`)
        .catch(() => ({ data: null, status: 0 }));

    if (pendingStatus === 200 && Array.isArray(pendingData)) {
      const pendingRows = pendingData as Array<{
        txHash: string;
        outputIndex: number;
        createdAt?: string | null;
      }>;

      for (const row of pendingRows) {
        const ref = `${row.txHash}#${row.outputIndex}`;
        const isUnspentOnChain = walletRefSet.has(ref);
        const isStale =
          row.createdAt != null &&
          Date.now() - new Date(row.createdAt).getTime() > STALE_PENDING_AGE_MS;

        if (isUnspentOnChain || isStale) {
          await this.dbRevertPending(
            projectWalletId,
            row.txHash,
            row.outputIndex,
          ).catch(() => {});
          recovered++;
        }
      }
    }

    // ── Pass 2: wrongly-marked-spent UTxOs ───────────────────────────────────
    // Only check UTxOs that could be sponsor candidates (right amount, lovelace-only,
    // past lexicographic guard). Runs in parallel to keep latency low.
    const candidates =
      requiredAmountStr && staticRef
        ? walletUtxos.filter((u) => {
            const first = u.output.amount[0];
            if (first?.unit !== "lovelace") return false;
            if (first.quantity !== requiredAmountStr) return false;
            const ref = `${u.input.txHash}#${u.input.outputIndex}`;
            return ref > staticRef;
          })
        : walletUtxos;

    const spentChecks = candidates.map(async (utxo) => {
      const { data: row, status: s } = await this.sdk.axiosInstance
        .get(
          `api/sponsorship/output/${projectWalletId}/${utxo.input.txHash}/${utxo.input.outputIndex}`,
        )
        .catch(() => ({ data: null, status: 0 }));
      if (s === 200 && row && (row as SponsorshipOutput).isSpent) {
        // On-chain this UTxO is unspent (it's in walletUtxos). DB diverged.
        await this.dbRevertPending(
          projectWalletId,
          utxo.input.txHash,
          utxo.input.outputIndex,
        ).catch(() => {});
        return 1 as const;
      }
      return 0 as const;
    });

    const spentResults = await Promise.allSettled(spentChecks);
    recovered += spentResults.reduce(
      (sum, r) => sum + (r.status === "fulfilled" ? r.value : 0),
      0,
    );

    if (recovered > 0) {
      console.log(
        `[SponsorshipV2] sweep recovered ${recovered} diverged UTxO(s) for wallet ${projectWalletId}`,
      );
    }
    return { recovered };
  }

  // ---------------------------------------------------------------------------
  // UTxO classification
  // ---------------------------------------------------------------------------

  private getStaticRef(): string {
    const u = meshUniversalStaticUtxo[this.sdk.network]["99"];
    return `${u.input.txHash}#${u.input.outputIndex}`;
  }

  /**
   * A UTxO is viable iff:
   *   1. Lovelace-only (no native tokens)
   *   2. Exact amount matches requiredAmountStr
   *   3. Not currently pending/reserved in DB
   *   4. Ref sorts AFTER the static placeholder ref (Plutus redeemer index guard)
   */
  private filterViable(
    utxos: UTxO[],
    pendingIds: Set<string>,
    requiredAmountStr: string,
    staticRef: string,
  ): UTxO[] {
    return utxos.filter((utxo) => {
      const first = utxo.output.amount[0];
      if (first?.unit !== "lovelace") return false;
      if (first.quantity !== requiredAmountStr) return false;
      const ref = `${utxo.input.txHash}#${utxo.input.outputIndex}`;
      if (pendingIds.has(ref)) return false;
      if (!(ref > staticRef)) return false;
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // UTxO selection — two-layer concurrency guard
  // ---------------------------------------------------------------------------

  private async selectUtxo(
    candidates: UTxO[],
    projectWalletId: string,
  ): Promise<{ utxo: UTxO; ref: string } | null> {
    // Fisher-Yates shuffle
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    for (const utxo of shuffled) {
      const ref = `${utxo.input.txHash}#${utxo.input.outputIndex}`;

      // Layer 1: in-process gate (synchronous)
      if (!tryReserve(projectWalletId, ref)) continue;

      try {
        // Layer 2: cross-process DB gate (isPending OR isSpent)
        const alreadyUsed = await this.dbIsReservedOrSpent(
          projectWalletId,
          utxo.input.txHash,
          utxo.input.outputIndex,
        );
        if (alreadyUsed) { release(projectWalletId, ref); continue; }

        await this.dbMarkPending(projectWalletId, utxo.input.txHash, utxo.input.outputIndex);
        return { utxo, ref };
      } catch {
        release(projectWalletId, ref);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Tx rebuild via tx-parser
  // ---------------------------------------------------------------------------

  private async rebuildTx({
    txHex, address, walletUtxos, selectedUtxo,
  }: {
    txHex: string;
    address: string;
    walletUtxos: UTxO[];
    selectedUtxo: UTxO;
  }): Promise<string> {
    const body: SponsorshipTxParserPostRequestBody = {
      txHex,
      address,
      utxos: JSON.stringify(walletUtxos),
      sponsorUtxo: JSON.stringify(selectedUtxo),
      network: this.sdk.network,
    };
    const { data, status } = await this.sdk.axiosInstance.post(
      "api/sponsorship/tx-parser",
      body,
    );
    if (status !== 200 || !data?.rebuiltTxHex || typeof data.rebuiltTxHex !== "string") {
      throw new Error(`tx-parser failed (status=${status})`);
    }
    return data.rebuiltTxHex as string;
  }

  // ---------------------------------------------------------------------------
  // Fallback path — refreshTxHash pool
  // ---------------------------------------------------------------------------

  private async tryFallback({
    config, address, walletUtxos, txHex, projectWalletId,
  }: {
    config: SponsorshipV2Config;
    address: string;
    walletUtxos: UTxO[];
    txHex: string;
    projectWalletId: string;
  }): Promise<string> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/sponsorship/${config.id}/refreshTxHash`,
    );
    if (status !== 200 || !data?.refreshTxHash) {
      throw new Error("No fallback UTxOs available (refreshTxHash missing)");
    }
    const refreshTxHash = data.refreshTxHash as string;
    const indices = shuffledIndices(config.numUtxosPrepare);

    for (const idx of indices) {
      const ref = `${refreshTxHash}#${idx}`;
      if (!tryReserve(projectWalletId, ref)) continue;
      let marked = false;
      try {
        const alreadyUsed = await this.dbIsReservedOrSpent(projectWalletId, refreshTxHash, idx);
        if (alreadyUsed) { release(projectWalletId, ref); continue; }
        await this.dbMarkPending(projectWalletId, refreshTxHash, idx);
        marked = true;
        const candidateUtxo: UTxO = {
          input: { txHash: refreshTxHash, outputIndex: idx },
          output: {
            amount: [{ unit: "lovelace", quantity: (config.utxoAmount * 1_000_000).toString() }],
            address,
          },
        };
        const rebuiltTxHex = await this.rebuildTx({
          txHex, address, walletUtxos, selectedUtxo: candidateUtxo,
        });
        release(projectWalletId, ref);
        return rebuiltTxHex;
      } catch {
        if (marked) {
          await this.dbRevertPending(projectWalletId, refreshTxHash, idx).catch(() => {});
        }
        release(projectWalletId, ref);
      }
    }
    throw new Error("All fallback UTxO candidates exhausted.");
  }

  // ---------------------------------------------------------------------------
  // Consolidation
  // ---------------------------------------------------------------------------

  private async consolidate({
    wallet, address, config, staticRef, requiredAmountStr,
  }: {
    wallet: any;
    address: string;
    config: SponsorshipV2Config;
    staticRef: string;
    requiredAmountStr: string;
  }): Promise<{ txHash: string }> {
    const utxos: UTxO[] = await wallet.getUtxosMesh();
    const pendingIds = await this.getPendingIds(config.projectWalletId);

    const candidates = utxos.filter((utxo) => {
      const first = utxo.output.amount[0];
      if (first?.unit !== "lovelace") return false;
      const ref = `${utxo.input.txHash}#${utxo.input.outputIndex}`;
      if (pendingIds.has(ref)) return false;
      return !(first.quantity === requiredAmountStr && ref > staticRef);
    });

    if (candidates.length === 0) {
      throw new Error("No consolidation candidates available in sponsor wallet.");
    }

    const totalLovelace = candidates.reduce(
      (sum, u) => sum + BigInt(u.output.amount[0]!.quantity), 0n,
    );
    const required = BigInt(requiredAmountStr);
    const FEE_BUFFER = 2_000_000n;
    const usable = totalLovelace > FEE_BUFFER ? totalLovelace - FEE_BUFFER : 0n;
    const outputCount = Math.min(config.numUtxosPrepare, Number(usable / required));

    if (outputCount === 0) {
      throw new Error("Insufficient lovelace to produce any sponsor UTxOs. Fund the wallet.");
    }

    const txBuilder = new MeshTxBuilder({ fetcher: this.sdk.providerFetcher });
    txBuilder.changeAddress(address);
    for (const utxo of candidates) {
      txBuilder.txIn(utxo.input.txHash, utxo.input.outputIndex, utxo.output.amount, utxo.output.address);
    }
    for (let i = 0; i < outputCount; i++) {
      txBuilder.txOut(address, [{ unit: "lovelace", quantity: requiredAmountStr }]);
    }

    const unsignedTx = await txBuilder.complete();
    const signedTx: string = await wallet.signTxReturnFullTx(unsignedTx);

    if (!this.sdk.providerSubmitter) {
      throw new Error("SponsorshipV2 requires sdk.providerSubmitter to be configured.");
    }
    const txHash = await this.sdk.providerSubmitter.submitTx(signedTx);

    await this.sdk.axiosInstance.post(
      `api/sponsorship/${config.id}/refreshTxHash`, { txHash },
    );
    await trackDeveloperTransaction(this.sdk.axiosInstance, this.sdk.network, "cardano", "tx-submit");

    return { txHash };
  }

  private consolidateBackground(args: {
    wallet: any;
    address: string;
    config: SponsorshipV2Config;
    staticRef: string;
    requiredAmountStr: string;
  }): void {
    const { projectWalletId } = args.config;
    if (this.consolidationInFlight.get(projectWalletId)) return;

    const promise = this.consolidate(args)
      .catch((err) => {
        console.warn(`[SponsorshipV2] background consolidation failed:`, err?.message);
        return { txHash: "" };
      })
      .finally(() => { this.consolidationInFlight.set(projectWalletId, null); });

    this.consolidationInFlight.set(projectWalletId, promise);
  }

  // ---------------------------------------------------------------------------
  // Wallet singleton
  // ---------------------------------------------------------------------------

  private async getOrInitWallet(projectWalletId: string): Promise<WalletHandle> {
    const cached = SponsorshipV2.walletHandles.get(projectWalletId);
    if (cached) return cached;

    const promise = (async () => {
      const result = await this.sdk.wallet.cardano.getWallet(projectWalletId);
      const wallet = result.wallet;
      const address: string = await wallet.getChangeAddressBech32();
      return { wallet, address };
    })().catch((err) => {
      SponsorshipV2.walletHandles.delete(projectWalletId);
      throw err;
    });

    SponsorshipV2.walletHandles.set(projectWalletId, promise);
    return promise;
  }

  // ---------------------------------------------------------------------------
  // Propagation polling
  // ---------------------------------------------------------------------------

  private async pollUntilRef(
    wallet: any,
    ref: string,
    maxAttempts = 5,
    delayMs = 1_000,
  ): Promise<UTxO[]> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const utxos: UTxO[] = await wallet.getUtxosMesh();
      if (utxos.some((u) => `${u.input.txHash}#${u.input.outputIndex}` === ref)) return utxos;
      if (attempt < maxAttempts) await new Promise<void>((r) => setTimeout(r, delayMs));
    }
    throw new Error(`Consolidated UTxO ${ref} did not propagate after ${maxAttempts} polls.`);
  }

  // ---------------------------------------------------------------------------
  // DB helpers
  // ---------------------------------------------------------------------------

  private async getPendingIds(projectWalletId: string): Promise<Set<string>> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/sponsorship/output/${projectWalletId}/pending`,
    );
    if (status !== 200) throw new Error("Failed to fetch pending UTxOs from DB");
    const rows = data as Array<{ txHash: string; outputIndex: number }>;
    return new Set(rows.map((r) => `${r.txHash}#${r.outputIndex}`));
  }

  /**
   * V1 bug: only checked isSpent. V2 checks isPending OR isSpent so an in-flight
   * reservation from another request is correctly detected as unavailable.
   */
  private async dbIsReservedOrSpent(
    projectWalletId: string,
    txHash: string,
    outputIndex: number,
  ): Promise<boolean> {
    const { data, status } = await this.sdk.axiosInstance.get(
      `api/sponsorship/output/${projectWalletId}/${txHash}/${outputIndex}`,
    );
    if (status === 404 || !data) return false;
    if (status === 200) {
      const row = data as SponsorshipOutput;
      return row.isPending || row.isSpent;
    }
    throw new Error(`dbIsReservedOrSpent returned unexpected status ${status}`);
  }

  private async dbMarkPending(projectWalletId: string, txHash: string, outputIndex: number): Promise<void> {
    const { status } = await this.sdk.axiosInstance.put(
      `api/sponsorship/output/${projectWalletId}/${txHash}/${outputIndex}`,
      { isPending: true, isSpent: false },
    );
    if (status !== 200) throw new Error(`dbMarkPending failed (status=${status})`);
  }

  private async dbRevertPending(projectWalletId: string, txHash: string, outputIndex: number): Promise<void> {
    await this.sdk.axiosInstance.put(
      `api/sponsorship/output/${projectWalletId}/${txHash}/${outputIndex}`,
      { isPending: false, isSpent: false },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffledIndices(length: number): number[] {
  const a = Array.from({ length }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
