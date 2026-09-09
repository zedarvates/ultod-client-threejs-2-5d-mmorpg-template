import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { GeneratedGameSite } from "../../packages/game-site-generator/src";

export interface GeneratedSiteServer {
  url: string;
  requests: string[];
  close(): Promise<void>;
}

export async function startGeneratedSiteServer(site: GeneratedGameSite): Promise<GeneratedSiteServer> {
  const files = new Map(site.files.map((file) => [`/${file.path}`, file]));
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    requests.push(path);
    const file = files.get(path === "/" ? "/index.html" : path);
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": file.mediaType,
      "cache-control": "no-store",
    });
    response.end(Buffer.from(file.bytes));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
