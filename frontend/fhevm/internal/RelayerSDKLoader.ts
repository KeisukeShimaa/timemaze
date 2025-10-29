import { SDK_CDN_URL } from "./constants";

type TraceType = ((...args: any[]) => void) | undefined;

function isFhevmWindowType(w: any): w is any {
  return typeof w !== "undefined" && w && typeof (w as any).relayerSDK !== "undefined";
}

export class RelayerSDKLoader {
  private _trace?: TraceType;
  constructor(options: { trace?: TraceType }) {
    this._trace = options.trace;
  }

  public load(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isFhevmWindowType(window)) return resolve();

      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        if (!isFhevmWindowType(window)) {
          reject(new Error("window.relayerSDK is not available"));
          return;
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load Relayer SDK from ${SDK_CDN_URL}`));

      document.head.appendChild(script);
    });
  }
}



