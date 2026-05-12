import Image from "next/image";
import { ConnectedWalletLedger } from "@/ui/wallet/connected-wallet-ledger";
import heroBackground from "./assets/hero-background.png";
import logo from "./assets/logo.png";

export default function HomePage() {
  return (
    <main className="landing">
      <Image
        src={heroBackground}
        alt="Abstract market motion background"
        className="landing__bg"
        priority
      />
      <div className="landing__overlay" />

      <section className="landing__content">
        <article className="landing__hero-shell motion-fade-up motion-delay-1">
          <header className="landing__topbar">
            <div className="landing__brand">
              <Image src={logo} alt="The Cab logo" className="landing__logo" priority />
              <span className="landing__brand-name">The Cab</span>
            </div>
            <span className="landing__status">Base Mainnet Ready</span>
          </header>

          <div className="landing__hero-main motion-fade-up motion-delay-2">
            <p className="eyebrow">Portfolio Intelligence</p>
            <h1 className="landing__motto">
              <span>YOUR PORTFOLIO.</span>
              <br />
              <span className="landing__motto-line--teal">UNDER CONTROL.</span>
            </h1>

            <p className="landing__copy">
              The Cab is your control tower for on-chain portfolios. Clarity. Performance.
              Precision.
            </p>

            <div className="landing__cta-row">
              <ConnectedWalletLedger layout="hero" />
              <a className="landing__learn-more" href="/portfolio">
                Learn more
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}