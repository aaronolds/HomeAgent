import type { GatewayConfig } from "../config/gateway-config.js";
import { loadOrGenerateCertificate } from "./certificate-manager.js";

export async function buildTlsOptions(
	config: GatewayConfig,
): Promise<{ https: { cert: string; key: string } } | null> {
	if (config.insecure) {
		return null;
	}

	const certificateResult = await loadOrGenerateCertificate(config);
	const certificateSource = certificateResult.selfSigned
		? "self-signed"
		: "user-provided";

	console.log(`[gateway] using ${certificateSource} TLS certificate`);

	return {
		https: {
			cert: certificateResult.cert,
			key: certificateResult.key,
		},
	};
}
