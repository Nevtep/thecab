import {
  findKnownMellowStrategy,
  inferMellowStakingRewardsAddress,
  inferMellowStrategyFromTransaction
} from "@/domains/protocols/mellow/mellow-strategy-inference";

describe("mellow strategy inference", () => {
  it("infers a wrapper from a share-token style deposit transaction", () => {
    const walletAddress = "0x1000000000000000000000000000000000000001";
    const wrapperAddress = "0x0df5f2662e4a8c801c04d83df717476509816250";

    const inferred = inferMellowStrategyFromTransaction({
      walletAddress,
      transactionTarget: wrapperAddress,
      transfers: [
        {
          tokenAddress: wrapperAddress,
          from: "0x0000000000000000000000000000000000000000",
          to: walletAddress,
          value: 900000000000000000n
        },
        {
          tokenAddress: "0x4200000000000000000000000000000000000006",
          from: walletAddress,
          to: "0x3000000000000000000000000000000000000001",
          value: 300000000000000000n
        },
        {
          tokenAddress: "0xcbb7000000000000000000000000000000000001",
          from: walletAddress,
          to: "0x3000000000000000000000000000000000000001",
          value: 10000000n
        }
      ],
      positions: []
    });

    expect(inferred).toEqual({
      wrapperAddress,
      stakingRewardsAddress: null,
      sourceContractAddress: wrapperAddress,
      pool: null
    });
  });

  it("reuses a previously inferred wrapper for reward-only transactions", () => {
    const strategy = findKnownMellowStrategy({
      candidateAddresses: ["0x0Df5f2662e4a8C801c04D83Df717476509816250"],
      positions: [
        {
          shareBalanceRaw: "900000000000000000",
          wrapperAddress: "0x0Df5f2662e4a8C801c04D83Df717476509816250",
          stakingRewardsAddress: null,
          pool: null
        }
      ]
    });

    expect(strategy?.wrapperAddress).toBe("0x0df5f2662e4a8c801c04d83df717476509816250");
    expect(strategy?.sourceContractAddress).toBe("0x0df5f2662e4a8c801c04d83df717476509816250");
  });

  it("infers a staking rewards address from a reward-only transaction", () => {
    const walletAddress = "0x1000000000000000000000000000000000000001";

    const inferred = inferMellowStakingRewardsAddress({
      walletAddress,
      transactionTarget: "0x2000000000000000000000000000000000000002",
      wrapperAddress: "0x0Df5f2662e4a8C801c04D83Df717476509816250",
      transfers: [
        {
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          from: "0x2000000000000000000000000000000000000002",
          to: walletAddress,
          value: 5000000000000000000n
        }
      ]
    });

    expect(inferred).toBe("0x2000000000000000000000000000000000000002");
  });
});