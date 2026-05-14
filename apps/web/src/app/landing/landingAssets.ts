export type LandingAssetId =
  | "pageBackground"
  | "heroBackground"
  | "heroVisual"
  | "problemSectionBackground"
  | "problemPoolExposure"
  | "problemStrategies"
  | "problemRewards"
  | "problemActivity"
  | "productPromiseVisual"
  | "howItWorksStep01"
  | "howItWorksStep02"
  | "howItWorksStep03"
  | "howItWorksStep04"
  | "howItWorksStep05"
  | "modelClarityDiagram"
  | "activityIntelligenceVisual"
  | "trustReadOnly"
  | "coverageFull"
  | "coverageShareLevel"
  | "coveragePartial"
  | "coverageUnknown"
  | "finalCtaBackground";

export type LandingAsset = {
  src: string;
  width: number;
  height: number;
  altKey?: string;
  decorative?: boolean;
};

export const landingAssets: Record<LandingAssetId, LandingAsset> = {
  pageBackground: {
    src: "/landing/background.webp",
    width: 1672,
    height: 941,
    decorative: true,
  },
  heroBackground: {
    src: "/landing/hero-background.webp",
    width: 1672,
    height: 941,
    decorative: true,
  },
  heroVisual: {
    src: "/landing/hero-visual.webp",
    width: 1448,
    height: 1086,
    altKey: "landing:a11y.heroVisualAlt",
  },
  problemSectionBackground: {
    src: "/landing/problem_section_background_rgba.webp",
    width: 1672,
    height: 941,
    decorative: true,
  },
  problemPoolExposure: {
    src: "/landing/problem_01_pool_exposure_fragmented.webp",
    width: 768,
    height: 768,
    altKey: "landing:a11y.problemPoolExposureAlt",
  },
  problemStrategies: {
    src: "/landing/problem_02_strategies_not_manual_deposits.webp",
    width: 768,
    height: 768,
    altKey: "landing:a11y.problemStrategiesAlt",
  },
  problemRewards: {
    src: "/landing/problem_03_rewards_need_attribution.webp",
    width: 768,
    height: 768,
    altKey: "landing:a11y.problemRewardsAlt",
  },
  problemActivity: {
    src: "/landing/problem_04_activity_needs_interpretation.webp",
    width: 768,
    height: 768,
    altKey: "landing:a11y.problemActivityAlt",
  },
  productPromiseVisual: {
    src: "/landing/product_promise_visual_03.png",
    width: 1448,
    height: 1086,
    altKey: "landing:a11y.productPromiseVisualAlt",
  },
  howItWorksStep01: {
    src: "/landing/how_it_works_step_01_rgba.webp",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.howItWorksStep01Alt",
  },
  howItWorksStep02: {
    src: "/landing/how_it_works_step_02_rgba.webp",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.howItWorksStep02Alt",
  },
  howItWorksStep03: {
    src: "/landing/how_it_works_step_03_rgba.webp",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.howItWorksStep03Alt",
  },
  howItWorksStep04: {
    src: "/landing/how_it_works_step_04_rgba.webp",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.howItWorksStep04Alt",
  },
  howItWorksStep05: {
    src: "/landing/how_it_works_step_05_rgba.webp",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.howItWorksStep05Alt",
  },
  modelClarityDiagram: {
    src: "/landing/landing_pools_deposits_strategies_diagram.png",
    width: 1448,
    height: 1086,
    altKey: "landing:a11y.modelClarityVisualAlt",
  },
  activityIntelligenceVisual: {
    src: "/landing/landing_activity_interpretation_timeline.png",
    width: 1672,
    height: 941,
    altKey: "landing:a11y.activityIntelligenceVisualAlt",
  },
  trustReadOnly: {
    src: "/landing/landing_read_only_trust_icon_rgba.webp",
    width: 768,
    height: 768,
    altKey: "landing:a11y.trustReadOnlyAlt",
  },
  coverageFull: {
    src: "/landing/coverage_01_full.webp",
    width: 1254,
    height: 1254,
    altKey: "landing:a11y.coverageFullAlt",
  },
  coverageShareLevel: {
    src: "/landing/coverage_02_share_level.webp",
    width: 1254,
    height: 1254,
    altKey: "landing:a11y.coverageShareLevelAlt",
  },
  coveragePartial: {
    src: "/landing/coverage_03_partial.webp",
    width: 1254,
    height: 1254,
    altKey: "landing:a11y.coveragePartialAlt",
  },
  coverageUnknown: {
    src: "/landing/coverage_04_unknown.webp",
    width: 1254,
    height: 1254,
    altKey: "landing:a11y.coverageUnknownAlt",
  },
  finalCtaBackground: {
    src: "/landing/landing_final_cta_background.webp",
    width: 1024,
    height: 1024,
    decorative: true,
  },
};

export const landingValueCardOrder = [
  "poolExposure",
  "strategies",
  "rewards",
  "activity",
] as const;

export type LandingValueCardId = (typeof landingValueCardOrder)[number];

export const landingValueCardAssets: Record<LandingValueCardId, LandingAssetId> = {
  poolExposure: "problemPoolExposure",
  strategies: "problemStrategies",
  rewards: "problemRewards",
  activity: "problemActivity",
};

export const landingHowItWorksStepOrder = ["step01", "step02", "step03", "step04", "step05"] as const;

export type LandingHowItWorksStepId = (typeof landingHowItWorksStepOrder)[number];

export const landingHowItWorksAssets: Record<LandingHowItWorksStepId, LandingAssetId> = {
  step01: "howItWorksStep01",
  step02: "howItWorksStep02",
  step03: "howItWorksStep03",
  step04: "howItWorksStep04",
  step05: "howItWorksStep05",
};

export const landingCoverageCardOrder = ["full", "shareLevel", "partial", "unknown"] as const;

export type LandingCoverageCardId = (typeof landingCoverageCardOrder)[number];

export const landingCoverageAssets: Record<LandingCoverageCardId, LandingAssetId> = {
  full: "coverageFull",
  shareLevel: "coverageShareLevel",
  partial: "coveragePartial",
  unknown: "coverageUnknown",
};