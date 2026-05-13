import { base } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = [
	injected({ shimDisconnect: true }),
	...(walletConnectProjectId && walletConnectProjectId !== "your_walletconnect_project_id"
		? [
				walletConnect({
					projectId: walletConnectProjectId,
					metadata: {
						name: "The Cab",
						description: "The Cab wallet connection",
						url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
						icons: [],
					},
					showQrModal: true,
				}),
			]
		: []),
];

export const wagmiConfig = createConfig({
	chains: [base],
	connectors,
	transports: {
		[base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org"),
	},
});
