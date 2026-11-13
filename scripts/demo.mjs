import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const fixture = await readFile(new URL("../fixtures/barriers.html", import.meta.url));
createServer((request, response) => {
  if (request.url !== "/") {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixture);
}).listen(4173, "127.0.0.1", () => {
  console.log("Demo fixture: http://127.0.0.1:4173/");
});
