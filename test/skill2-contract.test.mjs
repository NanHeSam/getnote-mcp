import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const clientSource = fs.readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");

test("Skill 2.0 first-class tools stay registered", () => {
  for (const name of [
    "get_note_original",
    "get_note_transcript",
    "get_note_attachments",
    "get_note_timeline",
    "get_note_quick_note",
    "list_topic_directories",
    "create_topic_directory",
    "update_topic_directory",
    "delete_topic_directory",
    "follow_topic_blogger",
  ]) {
    assert.match(indexSource, new RegExp(`name: ["']${name}["']`), `${name} must be registered`);
    assert.match(indexSource, new RegExp(`case ["']${name}["']`), `${name} must have a handler`);
  }
});

test("Knowledge directory and blogger tools use the public OpenAPI routes", () => {
  for (const route of [
    "/resource/knowledge/directories",
    "/resource/knowledge/directory/create",
    "/resource/knowledge/directory/update",
    "/resource/knowledge/directory/delete",
    "/resource/knowledge/blogger/follow",
  ]) {
    assert.ok(clientSource.includes(route), `${route} must remain in the client contract`);
  }
});
