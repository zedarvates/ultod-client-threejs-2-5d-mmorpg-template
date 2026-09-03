// SPDX-License-Identifier: MIT
// Auto-start the browser-local synthetic runtime for the public 2.5D demo.
// It is intentionally separate from the canonical/private Zig server.

import { NetworkClient } from "../../packages/client-core/src/net/network-client";
import {
  createLocalDemoSocketFactory,
  LOCAL_DEMO_ENDPOINT,
  LOCAL_DEMO_TOKEN,
} from "./local-demo-socket";

declare global {
  interface Window {
    __ultodLocalDemoClient?: NetworkClient;
  }
}

// One shared application-facing client: the HUD/game shell and the automatic
// local bootstrap both observe this exact NetworkClient instance. The socket
// factory remains the browser-local synthetic Worker transport only.
export const localDemoClient = new NetworkClient(createLocalDemoSocketFactory());

if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  window.__ultodLocalDemoClient = localDemoClient;
  document.body.dataset.demoRuntime = "starting";
  document.body.dataset.demoProof = "SYNTHETIC_FIXTURE_ONLY";

  void localDemoClient.connect({
    url: LOCAL_DEMO_ENDPOINT,
    token: LOCAL_DEMO_TOKEN,
    timeoutMs: 2000,
  }).then(() => {
    document.body.dataset.demoRuntime = "ready";
  }).catch((error: unknown) => {
    document.body.dataset.demoRuntime = "error";
    const reason = error instanceof Error ? error.message : "unknown local demo runtime error";
    console.warn(`[local-demo] ${reason}`);
  });
}
