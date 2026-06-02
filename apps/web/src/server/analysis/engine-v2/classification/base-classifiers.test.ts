import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";

import { classificationFromSnapshot, classifyBaseTransaction } from "./base-classifiers";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("classifyBaseTransaction identifies failed transactions", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      receipt_status: "0",
      internal_transactions: [{ error: "execution reverted" }],
    },
  });

  assert.equal(result.eventType, "failed_transaction");
  assert.equal(result.coverageStatus, "full");
});

test("classifyBaseTransaction identifies native cash-in without semantic guessing", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      value: "100",
      logs: [],
    },
  });

  assert.equal(result.eventType, "cash_in_native");
  assert.equal(result.eventFamily, "cashflow");
});

test("classifyBaseTransaction keeps unknown inbound token transfers partial", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      value: "0",
      logs: [
        {
          address: "0x0000000000000000000000000000000000000003",
          topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          decoded_event: {
            params: [
              { name: "from", value: "0x0000000000000000000000000000000000000002" },
              { name: "to", value: walletAddress },
              { name: "amount", value: "1" },
            ],
          },
        },
      ],
    },
  });

  assert.equal(result.eventType, "inbound_token_transfer_needs_counterparty_label");
  assert.equal(result.coverageStatus, "partial");
});

test("classifyBaseTransaction excludes explicit spam and airdrop flags without guessing", () => {
  const spam = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      possible_spam: true,
    } as never,
  });
  const airdrop = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x2",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      airdrop: true,
    } as never,
  });

  assert.equal(spam.coverageStatus, "excluded");
  assert.equal(spam.eventType, "excluded_spam");
  assert.equal(airdrop.coverageStatus, "excluded");
  assert.equal(airdrop.eventType, "excluded_airdrop");
});

test("classificationFromSnapshot maps the shared research snapshot into Engine V2 event fields", () => {
  const result = classificationFromSnapshot({
    hash: "0x1",
    timestamp: "2026-01-01T00:00:00.000Z",
    blockNumber: 123,
    transactionIndex: 4,
    fromAddress: "0x0000000000000000000000000000000000000002",
    toAddress: walletAddress,
    selector: "0xa9059cbb",
    contractLabel: "USDC",
    contractName: "USD Coin",
    decodedFunction: "transfer",
    decodedArgs: [],
    transferCount: 1,
    inboundTransferCount: 1,
    outboundTransferCount: 0,
    approvalCount: 0,
    classification: "cash_in_native",
    confidence: "high",
    reason: "native transfer into wallet",
    needsResolution: false,
  });

  assert.equal(result.eventType, "cash_in_native");
  assert.equal(result.eventFamily, "cashflow");
  assert.equal(result.evidence.sourceClassifier, "decoded-history-snapshot");
  assert.equal(result.evidence.selector, "0xa9059cbb");
  assert.equal(result.evidence.decodedFunction, "transfer");
  assert.equal(result.evidence.transferCount, 1);
  assert.equal(result.metadataJson?.contractLabel, "USDC");
  assert.equal(result.metadataJson?.decodedFunction, "transfer");
});

test("classifyBaseTransaction carries snapshot-derived evidence for decoded protocol calls", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    registry: new Map([
      [
        "0x0000000000000000000000000000000000000010",
        {
          chainId: 8453,
          address: "0x0000000000000000000000000000000000000010",
          label: "Test Router",
          protocol: "test",
          expectedKind: "router",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          sources: {
            basescanApi: "",
            basescanCode: "",
          },
          source: {
            contractName: "Router",
            compilerVersion: null,
            optimizationUsed: null,
            runs: null,
            constructorArguments: null,
            evmVersion: null,
            library: null,
            licenseType: null,
            proxy: false,
            implementation: null,
            swarmSource: null,
          },
          abi: [
            {
              type: "function",
              name: "execute",
              stateMutability: "nonpayable",
              inputs: [],
              outputs: [],
            },
          ],
          warnings: [],
        },
      ],
    ]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: "0x0000000000000000000000000000000000000010",
      receipt_status: "1",
      input: "0x61461954",
      logs: [],
    },
  });

  assert.equal(result.eventType, "router_execute");
  assert.equal(result.evidence.selector, "0x61461954");
  assert.equal(result.evidence.contractLabel, "Test Router");
  assert.equal(result.evidence.contractName, "Router");
  assert.equal(result.evidence.decodedFunction, "execute");
});

test("classifyBaseTransaction prefers manual withdrawal over fee claim for position-manager multicall burn closures", () => {
  const positionManagerAddress = "0x827922686190790b37229fd06084350e74485b72";
  const positionManagerAbi = [
    {
      type: "function",
      name: "collect",
      stateMutability: "payable",
      inputs: [
        {
          name: "params",
          type: "tuple",
          components: [
            { name: "tokenId", type: "uint256" },
            { name: "recipient", type: "address" },
            { name: "amount0Max", type: "uint128" },
            { name: "amount1Max", type: "uint128" },
          ],
        },
      ],
      outputs: [
        { name: "amount0", type: "uint256" },
        { name: "amount1", type: "uint256" },
      ],
    },
    {
      type: "function",
      name: "burn",
      stateMutability: "payable",
      inputs: [{ name: "tokenId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "multicall",
      stateMutability: "payable",
      inputs: [{ name: "data", type: "bytes[]" }],
      outputs: [{ name: "results", type: "bytes[]" }],
    },
  ] as const;

  const nestedCollect = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "collect",
    args: [{
      tokenId: 71093441n,
      recipient: walletAddress as `0x${string}`,
      amount0Max: 340282366920938463463374607431768211455n,
      amount1Max: 340282366920938463463374607431768211455n,
    }],
  });
  const nestedBurn = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "burn",
    args: [71093441n],
  });
  const input = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "multicall",
    args: [[nestedCollect, nestedBurn]],
  });

  const result = classifyBaseTransaction({
    walletAddress,
    registry: new Map([
      [
        positionManagerAddress,
        {
          chainId: 8453,
          address: positionManagerAddress,
          label: "Slipstream Nonfungible Position Manager",
          protocol: "aerodrome",
          expectedKind: "position-manager",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          sources: {
            basescanApi: "",
            basescanCode: "",
          },
          source: {
            contractName: "SlipstreamPositionManager",
            compilerVersion: null,
            optimizationUsed: null,
            runs: null,
            constructorArguments: null,
            evmVersion: null,
            library: null,
            licenseType: null,
            proxy: false,
            implementation: null,
            swarmSource: null,
          },
          abi: positionManagerAbi,
          warnings: [],
        },
      ],
    ]),
    tx: {
      hash: "0x2172b8baa05b415386da481590df5df33c49a6f0666603920bdf0ba7fa25c459",
      from_address: walletAddress,
      to_address: positionManagerAddress,
      receipt_status: "1",
      input,
      logs: [],
    },
  });

  assert.equal(result.eventType, "manual_position_withdraw");
  assert.equal(result.evidence.decodedFunction, "multicall");
});

test("classifyBaseTransaction keeps out-of-range decrease+collect+burn multicalls as manual withdrawal", () => {
  const positionManagerAddress = "0x827922686190790b37229fd06084350e74485b72";
  const positionManagerAbi = [
    {
      type: "function",
      name: "decreaseLiquidity",
      stateMutability: "payable",
      inputs: [
        {
          name: "params",
          type: "tuple",
          components: [
            { name: "tokenId", type: "uint256" },
            { name: "liquidity", type: "uint128" },
            { name: "amount0Min", type: "uint256" },
            { name: "amount1Min", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
      ],
      outputs: [
        { name: "amount0", type: "uint256" },
        { name: "amount1", type: "uint256" },
      ],
    },
    {
      type: "function",
      name: "collect",
      stateMutability: "payable",
      inputs: [
        {
          name: "params",
          type: "tuple",
          components: [
            { name: "tokenId", type: "uint256" },
            { name: "recipient", type: "address" },
            { name: "amount0Max", type: "uint128" },
            { name: "amount1Max", type: "uint128" },
          ],
        },
      ],
      outputs: [
        { name: "amount0", type: "uint256" },
        { name: "amount1", type: "uint256" },
      ],
    },
    {
      type: "function",
      name: "burn",
      stateMutability: "payable",
      inputs: [{ name: "tokenId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "multicall",
      stateMutability: "payable",
      inputs: [{ name: "data", type: "bytes[]" }],
      outputs: [{ name: "results", type: "bytes[]" }],
    },
  ] as const;

  const nestedDecreaseLiquidity = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "decreaseLiquidity",
    args: [{
      tokenId: 69402012n,
      liquidity: 141192708922613n,
      amount0Min: 0n,
      amount1Min: 0n,
      deadline: 1748410500n,
    }],
  });
  const nestedCollect = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "collect",
    args: [{
      tokenId: 69402012n,
      recipient: walletAddress as `0x${string}`,
      amount0Max: 340282366920938463463374607431768211455n,
      amount1Max: 340282366920938463463374607431768211455n,
    }],
  });
  const nestedBurn = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "burn",
    args: [69402012n],
  });
  const input = encodeFunctionData({
    abi: positionManagerAbi,
    functionName: "multicall",
    args: [[nestedDecreaseLiquidity, nestedCollect, nestedBurn]],
  });

  const result = classifyBaseTransaction({
    walletAddress,
    registry: new Map([
      [
        positionManagerAddress,
        {
          chainId: 8453,
          address: positionManagerAddress,
          label: "Slipstream Nonfungible Position Manager",
          protocol: "aerodrome",
          expectedKind: "position-manager",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          sources: {
            basescanApi: "",
            basescanCode: "",
          },
          source: {
            contractName: "SlipstreamPositionManager",
            compilerVersion: null,
            optimizationUsed: null,
            runs: null,
            constructorArguments: null,
            evmVersion: null,
            library: null,
            licenseType: null,
            proxy: false,
            implementation: null,
            swarmSource: null,
          },
          abi: positionManagerAbi,
          warnings: [],
        },
      ],
    ]),
    tx: {
      hash: "0x88fb14fb47d93e40d0cc9c84da13c618808c6b5e4c2ff3a811646566a7bbecbc",
      from_address: walletAddress,
      to_address: positionManagerAddress,
      receipt_status: "1",
      input,
      logs: [],
    },
  });

  assert.equal(result.eventType, "manual_position_withdraw");
  assert.match(String(result.evidence.reason ?? ""), /decreaseLiquidity|burn/);
});

test("classifyBaseTransaction preserves tokenId for gauge getReward(uint256) claims", () => {
  const gaugeAddress = "0x00000000000000000000000000000000000000bb";
  const gaugeAbi = [
    {
      type: "function",
      name: "getReward",
      stateMutability: "nonpayable",
      inputs: [{ name: "tokenId", type: "uint256" }],
      outputs: [],
    },
  ] as const;

  const input = encodeFunctionData({
    abi: gaugeAbi,
    functionName: "getReward",
    args: [71251309n],
  });

  const result = classifyBaseTransaction({
    walletAddress,
    registry: new Map([
      [
        gaugeAddress,
        {
          chainId: 8453,
          address: gaugeAddress,
          label: "Slipstream CL Gauge",
          protocol: "aerodrome",
          expectedKind: "gauge",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          sources: {
            basescanApi: "",
            basescanCode: "",
          },
          source: {
            contractName: "CLGauge",
            compilerVersion: null,
            optimizationUsed: null,
            runs: null,
            constructorArguments: null,
            evmVersion: null,
            library: null,
            licenseType: null,
            proxy: false,
            implementation: null,
            swarmSource: null,
          },
          abi: gaugeAbi,
          warnings: [],
        },
      ],
    ]),
    tx: {
      hash: "0x0b9e0ea063cce6bd5c4c5952df3786b0ffa16fce749c50dc6ab14b6f51f6cb0f",
      from_address: walletAddress,
      to_address: gaugeAddress,
      receipt_status: "1",
      input,
      logs: [],
    },
  });

  assert.equal(result.eventType, "manual_gauge_reward_claim");
  assert.equal(result.metadataJson?.tokenId, "71251309");
  assert.equal(result.evidence.tokenId, "71251309");
});
