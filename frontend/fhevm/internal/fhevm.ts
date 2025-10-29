import type { ethers } from "ethers";
import { RelayerSDKLoader } from "./RelayerSDKLoader";

export type FhevmInstance = any;

type FhevmRelayerStatusType = "sdk-loading" | "sdk-initializing" | "creating" | "ready";

type Eip1193Provider = ethers.Eip1193Provider | string;

export async function createFhevmInstance(parameters: {
  provider: Eip1193Provider;
  mockChains?: Record<number, string>;
  signal?: AbortSignal;
  onStatusChange?: (s: FhevmRelayerStatusType) => void;
}): Promise<FhevmInstance> {
  const { provider, mockChains, signal, onStatusChange } = parameters;

  const throwIfAborted = () => {
    if (signal?.aborted) throw new Error("aborted");
  };

  const resolve = async () => {
    if (typeof provider === "string") {
      return { isMock: false, rpcUrl: provider, chainId: undefined };
    }
    const req = await provider.request({ method: "eth_chainId" });
    const chainId = typeof req === "string" ? parseInt(req, 16) : Number(req);
    const rpcUrl = mockChains?.[chainId];
    return { isMock: Boolean(rpcUrl), rpcUrl, chainId };
  };

  const { isMock, rpcUrl } = await resolve();

  if (isMock && rpcUrl) {
    const meta = await fetch(`${rpcUrl}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "fhevm_relayer_metadata", params: [] }),
    }).then(async (r) => (r.ok ? r.json() : null)).catch(() => null);

    const metadata = meta?.result;
    if (metadata) {
      const mod = await import("./mock/fhevmMock");
      throwIfAborted();
      return mod.fhevmMockCreateInstance({
        rpcUrl,
        chainId: 31337,
        metadata,
      });
    }
  }

  onStatusChange?.("sdk-loading");
  const loader = new RelayerSDKLoader({ trace: console.log });
  await loader.load();
  throwIfAborted();

  onStatusChange?.("sdk-initializing");
  // @ts-ignore
  const relayerSDK = (window as any).relayerSDK;
  await relayerSDK.initSDK();
  throwIfAborted();

  onStatusChange?.("creating");
  const instance = await relayerSDK.createInstance({
    ...relayerSDK.SepoliaConfig,
    network: provider,
  });

  return instance;
}



