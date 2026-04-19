import { LedgerProjectionService } from "@/domains/ledger/projections/ledger-projection-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type LedgerPageProps = {
  searchParams?: Promise<{
    sessionId?: string;
  }>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const params = (await searchParams) ?? {};

  if (!params.sessionId) {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Ledger Inspection</p>
          <h1>Open a reconstructed session</h1>
          <p>
            Provide <strong>?sessionId=...</strong> in the URL after creating a session and starting a
            reconstruction to inspect the canonical ledger projection.
          </p>
        </section>
      </main>
    );
  }

  const db = getDb();
  const projection = await new LedgerProjectionService(
    new SessionRepository(db),
    new ReconstructionRunRepository(db),
    new LedgerOutputRepository(db),
    new RawObservationRepository(db)
  ).getLatestProjection(params.sessionId);

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Ledger Inspection</p>
        <h1>Canonical ledger projection</h1>
        <p>
          Pools: {projection.pools.length} · Residual holdings: {projection.residualHoldings.length} ·
          Discarded items: {projection.discardedSummary.totalCount}
        </p>
        <pre style={{ marginTop: "1.5rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(projection, null, 2)}
        </pre>
      </section>
    </main>
  );
}