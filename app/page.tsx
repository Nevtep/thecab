import { ConnectedWalletLedger } from "@/ui/wallet/connected-wallet-ledger";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">The Cab</p>
        <h1>Connected-wallet canonical ledger</h1>
        <p>
          Connect a wallet on Base and reconstruct its live canonical ledger from real wallet
          transfers, Aerodrome position activity, and supported Mellow strategy surfaces.
        </p>
        <ConnectedWalletLedger />
      </section>
    </main>
  );
}