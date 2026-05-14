import { landingAssets } from "@/app/landing/landingAssets";

export const howItWorksSteps = [
  {
    id: "connectWallet",
    labelKey: "howItWorks.steps.connectWallet.label",
    titleKey: "howItWorks.steps.connectWallet.title",
    bodyKey: "howItWorks.steps.connectWallet.body",
    asset: landingAssets.howItWorksStep01,
    objectPosition: "72% 72%",
  },
  {
    id: "quickOverview",
    labelKey: "howItWorks.steps.quickOverview.label",
    titleKey: "howItWorks.steps.quickOverview.title",
    bodyKey: "howItWorks.steps.quickOverview.body",
    asset: landingAssets.howItWorksStep02,
    objectPosition: "50% 66%",
  },
  {
    id: "historicalAnalysis",
    labelKey: "howItWorks.steps.historicalAnalysis.label",
    titleKey: "howItWorks.steps.historicalAnalysis.title",
    bodyKey: "howItWorks.steps.historicalAnalysis.body",
    asset: landingAssets.howItWorksStep03,
    objectPosition: "60% 58%",
  },
  {
    id: "unlockSections",
    labelKey: "howItWorks.steps.unlockSections.label",
    titleKey: "howItWorks.steps.unlockSections.title",
    bodyKey: "howItWorks.steps.unlockSections.body",
    asset: landingAssets.howItWorksStep04,
    objectPosition: "62% 56%",
  },
  {
    id: "refreshStale",
    labelKey: "howItWorks.steps.refreshStale.label",
    titleKey: "howItWorks.steps.refreshStale.title",
    bodyKey: "howItWorks.steps.refreshStale.body",
    asset: landingAssets.howItWorksStep05,
    objectPosition: "58% 50%",
  },
] as const;

export type HowItWorksStepConfig = (typeof howItWorksSteps)[number];
