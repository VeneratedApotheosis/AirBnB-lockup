import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

const fixture = await readFile(new URL("../tests/fixtures/barriers.html", import.meta.url));
createServer((request, response) => {
  if (new URL(request.url ?? "/", "http://127.0.0.1").pathname !== "/") {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixture);
}).listen(4173, "127.0.0.1", () => {
  console.log("Demo fixture: http://127.0.0.1:4173/");
});
