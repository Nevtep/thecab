import {
  AlertTriangle,
  Activity,
  BarChart3,
  CircleHelp,
  Compass,
  Landmark,
  Gauge,
  Layers,
  Radar,
  Settings,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const cabIconRegistry = {
  radar: Radar,
  wallet: Wallet,
  warning: AlertTriangle,
  info: CircleHelp,
  dashboard: Gauge,
  pools: Layers,
  deposits: Wallet,
  strategies: Sparkles,
  activity: Activity,
  rewards: BarChart3,
  governance: Landmark,
  navigation: Compass,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>;

export type CabIconName = keyof typeof cabIconRegistry;
