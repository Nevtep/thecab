export type Address = `0x${string}`;
export type TxHash = `0x${string}`;

export type MoralisDecodedLog = {
  log_index?: string | number | null;
  address?: string | null;
  data?: string | null;
  topic0?: string | null;
  topic1?: string | null;
  topic2?: string | null;
  topic3?: string | null;
  decoded_event?: {
    label?: string | null;
    signature?: string | null;
    type?: string | null;
    params?: Array<{
      name?: string | null;
      value?: string | null;
      type?: string | null;
    }> | null;
  } | null;
};

export type MoralisInternalTransaction = {
  type?: string | null;
  from?: string | null;
  to?: string | null;
  value?: string | null;
  input?: string | null;
  output?: string | null;
  error?: string | null;
};

export type MoralisDecodedTransaction = {
  hash: string;
  nonce?: string | null;
  transaction_index?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  value?: string | null;
  gas?: string | null;
  gas_price?: string | null;
  input?: string | null;
  receipt_status?: string | null;
  receipt_gas_used?: string | null;
  block_timestamp?: string | null;
  block_number?: string | null;
  block_hash?: string | null;
  transaction_fee?: string | null;
  logs?: MoralisDecodedLog[] | null;
  internal_transactions?: MoralisInternalTransaction[] | null;
  decoded_call?: {
    signature?: string | null;
    label?: string | null;
    type?: string | null;
    params?: unknown[] | null;
  } | null;
};

export type ContractKind =
  | "token"
  | "router"
  | "position-manager"
  | "strategy-wrapper"
  | "gauge"
  | "pool"
  | "governance-voter"
  | "governance-lock"
  | "governance-rebase"
  | "read-helper"
  | "observed-contract";

export type ContractAbiSourceMetadata = {
  contractName: string | null;
  compilerVersion: string | null;
  optimizationUsed: string | null;
  runs: string | null;
  constructorArguments: string | null;
  evmVersion: string | null;
  library: string | null;
  licenseType: string | null;
  proxy: boolean;
  implementation: string | null;
  swarmSource: string | null;
};

export type ContractAbiRecord = {
  chainId: number;
  address: Address;
  label: string;
  protocol: string;
  expectedKind: ContractKind;
  fetchedAt: string;
  sources: {
    basescanApi: string;
    basescanCode: string;
    sourceHint?: string | null;
  };
  source: ContractAbiSourceMetadata;
  abi: readonly unknown[] | null;
  warnings: string[];
};

export type AbiRegistryEntry = ContractAbiRecord & {
  abi: readonly unknown[];
};

export type DecodedTxInput = {
  selector: string;
  entry: AbiRegistryEntry | null;
  functionName: string | null;
  args: readonly unknown[];
  error: string | null;
};

export type TokenTransferEvidence = {
  token: Address | "";
  from: Address | "";
  to: Address | "";
  value: string | null;
  logIndex: string | number | null | undefined;
};

export type TokenApprovalEvidence = {
  token: Address | "";
  owner: Address | "";
  spender: Address | "";
  amount: string | null;
  logIndex: string | number | null | undefined;
};

export type ClassificationConfidence =
  | "high"
  | "medium"
  | "low"
  | "high_action"
  | "high_action_partial_accounting"
  | "high_action_partial_breakdown"
  | "high_action_partial_value_effect"
  | "high_action_partial_semantics";

export type DecodedTransactionClassification = {
  classification: string;
  confidence: ClassificationConfidence;
  reason: string;
  needsResolution: boolean;
};

export type ClassifiedDecodedTransaction = {
  hash: TxHash;
  timestamp: string | null;
  blockNumber: number | null;
  transactionIndex: number | null;
  fromAddress: Address | "";
  toAddress: Address | "";
  selector: string;
  contractLabel: string | null;
  contractName: string | null;
  decodedFunction: string | null;
  decodedArgs: readonly unknown[];
  transferCount: number;
  inboundTransferCount: number;
  outboundTransferCount: number;
  approvalCount: number;
  classification: string;
  confidence: ClassificationConfidence;
  reason: string;
  needsResolution: boolean;
};

export type AbiRegistryRepository = {
  getContractAbi(input: {
    chainId: number;
    address: Address;
  }): Promise<AbiRegistryEntry | null>;
  putContractAbi(record: ContractAbiRecord): Promise<void>;
};
