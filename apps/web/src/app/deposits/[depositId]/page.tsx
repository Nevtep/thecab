import { DepositDetailContainer } from "@/features/deposits/DepositDetail.container";

export default async function DepositDetailPage(input: {
  params: Promise<{ depositId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { depositId } = await input.params;
  const searchParams = input.searchParams ? await input.searchParams : {};

  return (
    <div id="deposit-detail-content">
      <DepositDetailContainer depositId={depositId} backHref={searchParams.returnTo ?? "/deposits"} />
    </div>
  );
}