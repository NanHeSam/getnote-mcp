import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  GetNoteAPIError,
  GetNoteClient,
  parseJsonPreservingLargeIntegerStrings,
} from "../dist/client.js";
import { OPENAPI_MEMBERSHIP_PURCHASE_URL } from "../dist/membership.js";

test("membership errors use the MCP-specific OpenAPI purchase channel", () => {
  assert.equal(
    OPENAPI_MEMBERSHIP_PURCHASE_URL,
    "https://www.biji.com/checkout?product_alias=9Ab36BB3ZD&spm=openapi_mcp"
  );
});

test("large snowflake IDs are parsed and re-encoded as strings", () => {
  const parsed = parseJsonPreservingLargeIntegerStrings(`{
    "id": 1916020531058082912,
    "follow_id": 1916020531058082913,
    "children_ids": [1916020531058082914]
  }`);
  assert.equal(parsed.id, "1916020531058082912");
  assert.equal(parsed.follow_id, "1916020531058082913");
  assert.deepEqual(parsed.children_ids, ["1916020531058082914"]);
  assert.match(JSON.stringify(parsed), /"1916020531058082912"/);
});

test("HTTP 200 success=false exposes the complete structured error", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      success: false,
      data: null,
      error: {
        code: 10000,
        message: "参数错误",
        reason: "invalid_request",
        retryable: false,
        field: "parent_id",
        constraint: "non_negative_decimal_integer",
        expected_type: "decimal string or JSON integer",
      },
      request_id: "req_test",
    }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;

  try {
    await assert.rejects(
      () => new GetNoteClient("key", "client", baseURL).getNote("1e3"),
      (err) => {
        assert.ok(err instanceof GetNoteAPIError);
        assert.equal(err.field, "parent_id");
        assert.equal(err.constraint, "non_negative_decimal_integer");
        assert.equal(err.expectedType, "decimal string or JSON integer");
        assert.equal(err.requestId, "req_test");
        assert.equal(err.retryable, false);
        return true;
      }
    );
  } finally {
    server.close();
  }
});

test("OSS multipart fields use the signed names and order", async () => {
  let body = "";
  const server = http.createServer((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ h: { c: 0 }, c: { image: { id: "img_1" } } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const host = `http://127.0.0.1:${address.port}`;

  try {
    const client = new GetNoteClient("key", "client", host);
    const result = await client.uploadImageToOSS({
      accessid: "access",
      host,
      policy: "policy",
      signature: "signature",
      expire: 0,
      callback: "callback",
      object_key: "object",
      access_url: "https://example.test/object",
      oss_content_type: "image/png",
    }, Buffer.from("image"));
    assert.equal(result.image_id, "img_1");

    const names = [
      'name="key"',
      'name="OSSAccessKeyId"',
      'name="policy"',
      'name="signature"',
      'name="callback"',
      'name="Content-Type"',
      'name="file"',
    ];
    let previous = -1;
    for (const name of names) {
      const current = body.indexOf(name);
      assert.ok(current > previous, `${name} must follow the previous signed field`);
      previous = current;
    }
    assert.equal(body.includes('name="Signature"'), false);
    assert.equal(body.includes('name="success_action_status"'), false);
  } finally {
    server.close();
  }
});
