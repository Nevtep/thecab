import { normalizeWalletAddress } from "@/domains/wallet-session/model/analysis-session";
import { type AnalysisSessionRecordWithReuse, SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const BASE_CHAIN_ID = 8453;

export type ConnectedWalletSessionBootstrap = AnalysisSessionRecordWithReuse & {
  bootstrapState: "created" | "reused";
};

export class AnalysisSessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async createOrResumeConnectedWalletSession(input: {
    walletAddress: string;
    chainId: number;
    connectionSource: string;
  }): Promise<ConnectedWalletSessionBootstrap> {
    if (input.chainId !== BASE_CHAIN_ID) {
      throw new Error("Connected wallet analysis is only available on Base.");
    }

    const session = await this.sessionRepository.createOrResume({
      ...input,
      walletAddress: normalizeWalletAddress(input.walletAddress),
      connectionSource: input.connectionSource.trim() || "walletconnect"
    });

    return {
      ...session,
      bootstrapState: session.reusedSession ? "reused" : "created"
    };
  }

  async createOrResume(input: {
    walletAddress: string;
    chainId: number;
    connectionSource: string;
  }) {
    return this.createOrResumeConnectedWalletSession(input);
  }
}