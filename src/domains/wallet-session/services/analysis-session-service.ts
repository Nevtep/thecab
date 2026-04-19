import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

export class AnalysisSessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async createOrResume(input: {
    walletAddress: string;
    chainId: number;
    connectionSource: string;
  }) {
    return this.sessionRepository.createOrResume(input);
  }
}