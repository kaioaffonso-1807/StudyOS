import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../src/index.js";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to determine test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("health exposes liveness and request id", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id")?.length, 36);
  const body = await response.json() as { ok: boolean; service: string };
  assert.equal(body.ok, true);
  assert.equal(body.service, "studyos-english-api");
});

test("readiness returns 503 when database is not configured", async () => {
  const response = await fetch(`${baseUrl}/ready`);
  assert.equal(response.status, 503);
  const body = await response.json() as { ok: boolean; ready: boolean };
  assert.equal(body.ok, false);
  assert.equal(body.ready, false);
});
