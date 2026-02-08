declare namespace Deno {
  export interface ServeOptions {
    port: number;
  }
  export function serve(options: ServeOptions, handler: (req: Request) => Response | Promise<Response>): void;
  export function upgradeWebSocket(req: Request): { socket: any; response: Response };
  export function readFile(path: string): Promise<Uint8Array>;
  export const env: {
    get(key: string): string | undefined;
  };
}
