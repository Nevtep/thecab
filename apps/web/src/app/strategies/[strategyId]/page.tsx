import { StrategyDetailContainer } from "@/features/strategies/StrategyDetail.container";

export default async function StrategyDetailPage(input: {
  params: Promise<{ strategyId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { strategyId } = await input.params;
  const searchParams = input.searchParams ? await input.searchParams : {};

  return (
    <div id="strategy-detail-content">
      <StrategyDetailContainer strategyId={strategyId} backHref={searchParams.returnTo ?? "/strategies"} />
    </div>
  );
}
