import { ConnectedWalletLedger } from "@/ui/wallet/connected-wallet-ledger";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">The Cab</p>
        <h1>Start analysis from your connected wallet</h1>
        <p>
          Connect one wallet on Base, create or resume its analysis session, and enter the
          session-backed ledger flow without typing a wallet address manually.
        </p>
        <ConnectedWalletLedger />
      </section>
    </main>
  );
}