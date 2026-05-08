import { ConnectedWalletAnalysisView } from "@/ui/wallet/connected-wallet-analysis-view";
import { ConnectedWalletLedger } from "@/ui/wallet/connected-wallet-ledger";

type PortfolioPageProps = {
  searchParams?: Promise<{
    sessionId?: string;
  }>;
};

export default async function PortfolioPage({ searchParams }: PortfolioPageProps) {
  const params = (await searchParams) ?? {};

  if (!params.sessionId) {
    return (
      <main className="shell">
        <section className="panel">
          <p className="eyebrow">Portfolio Dashboard</p>
          <h1>Connect and load your portfolio session</h1>
          <p>
            Open an existing session with
            <strong> ?sessionId=...</strong> or start from the connected wallet flow below.
          </p>
          <ConnectedWalletLedger />
        </section>
      </main>
    );
  }

  return <ConnectedWalletAnalysisView sessionId={params.sessionId} />;
}
