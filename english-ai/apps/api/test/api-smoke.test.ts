import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../src/index.js";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to determine test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("health exposes liveness, request id and no-store", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id")?.length, 36);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("JSON mutation endpoints reject unsupported content types", async () => {
  const response = await fetch(`${baseUrl}/api/v1/progress`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not json",
  });
  assert.equal(response.status, 415);
  const body = await response.json() as { error: string };
  assert.match(body.error, /Content-Type/);
});

test("PUT and PATCH mutations also reject unsupported content types", async () => {
  for (const method of ["PUT", "PATCH"]) {
    const response = await fetch(`${baseUrl}/api/v1/users/demo-user/memory`, {
      method,
      headers: { "content-type": "text/plain" },
      body: "not json",
    });
    assert.equal(response.status, 415);
  }
});
