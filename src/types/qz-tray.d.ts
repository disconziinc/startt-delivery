declare module "qz-tray" {
  type QzConfig = unknown;
  type QzPrintData = Array<string | { type?: string; format?: string; flavor?: string; data: string | number[] | Uint8Array }>;

  const qz: {
    websocket: {
      connect(options?: Record<string, unknown>): Promise<void>;
      disconnect(): Promise<void>;
      isActive(): boolean;
    };
    printers: {
      find(query?: string): Promise<string | string[]>;
    };
    configs: {
      create(printer: string, options?: Record<string, unknown>): QzConfig;
    };
    security: {
      setCertificatePromise(handler: Promise<string> | (() => Promise<string>) | ((resolve: (value: string) => void, reject: (reason?: unknown) => void) => void), options?: Record<string, unknown>): void;
      setSignaturePromise(factory: (dataToSign: string) => Promise<string> | ((resolve: (value: string) => void, reject: (reason?: unknown) => void) => void)): void;
      setSignatureAlgorithm(algorithm: string): void;
    };
    print(config: QzConfig, data: QzPrintData): Promise<void>;
  };

  export default qz;
}
