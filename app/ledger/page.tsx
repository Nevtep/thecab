import { ConnectedWalletAnalysisView } from "@/ui/wallet/connected-wallet-analysis-view";
import { ConnectedWalletLedger } from "@/ui/wallet/connected-wallet-ledger";

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
          <h1>Connect and reconstruct a wallet</h1>
          <p>
            Run a live reconstruction for the connected wallet or open an existing session with
            <strong> ?sessionId=...</strong>.
          </p>
          <ConnectedWalletLedger />
        </section>
      </main>
    );
  }

  return <ConnectedWalletAnalysisView sessionId={params.sessionId} />;
}