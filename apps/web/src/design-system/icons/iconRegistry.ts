import {
  AlertTriangle,
  Activity,
  BarChart3,
  CircleHelp,
  Compass,
  Gauge,
  Layers,
  Radar,
  Settings,
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
  activity: Activity,
  rewards: BarChart3,
  navigation: Compass,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>;

export type CabIconName = keyof typeof cabIconRegistry;
