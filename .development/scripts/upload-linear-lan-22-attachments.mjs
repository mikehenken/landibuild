/**
 * Uploads `.development/linear-upload-attach-*.payload.json` to Linear issue LAN-22
 * using fileUpload + PUT + attachmentCreate (same flow as the Linear app).
 *
 * Requires: LINEAR_API_KEY (Personal API Key from Linear Settings > API)
 *
 * Usage (PowerShell):
 *   $env:LINEAR_API_KEY = "lin_api_..."
 *   node .development/scripts/upload-linear-lan-22-attachments.mjs
 *
 * Skips attach-2 payload (Ref 2 already uploaded via MCP).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_ROOT = join(__dirname, '..');
const GRAPHQL_URL = 'https://api.linear.app/graphql';
const ISSUE_IDENTIFIER = 'LAN-22';
/** Landi team id from Linear (stable for this workspace). */
const TEAM_ID = 'dee8383c-9e1c-4fb2-809f-4288275c1755';
const ISSUE_NUMBER = 22;

const key = process.env.LINEAR_API_KEY?.trim();
if (!key) {
  console.error('LINEAR_API_KEY is not set.');
  console.error('Create a key at Linear Settings > API, then:');
  console.error('  $env:LINEAR_API_KEY = "lin_api_..."');
  console.error('  node .development/scripts/upload-linear-lan-22-attachments.mjs');
  process.exit(1);
}

/** @param {string} s */
function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** @param {string} query @param {Record<string, unknown>} [variables] */
async function gql(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(j)}`);
  }
  if (j.errors?.length) {
    throw new Error(JSON.stringify(j.errors, null, 2));
  }
  return j.data;
}

async function getIssueUuid() {
  const data = await gql(
    `query IssueForUpload($filter: IssueFilter!) {
      issues(filter: $filter, first: 1) {
        nodes { id identifier }
      }
    }`,
    {
      filter: {
        team: { id: { eq: TEAM_ID } },
        number: { eq: ISSUE_NUMBER },
      },
    },
  );
  const n = data.issues?.nodes?.[0];
  if (!n?.id) {
    throw new Error(`Issue ${ISSUE_IDENTIFIER} not found for team ${TEAM_ID}`);
  }
  return n.id;
}

/**
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {string} filename
 */
async function uploadToLinearStorage(buffer, contentType, filename) {
  const size = buffer.length;
  const data = await gql(
    `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile {
          uploadUrl
          assetUrl
          headers { key value }
        }
      }
    }`,
    { contentType, filename, size },
  );
  const fu = data.fileUpload;
  if (!fu?.success || !fu.uploadFile?.uploadUrl) {
    throw new Error(`fileUpload failed: ${JSON.stringify(fu)}`);
  }
  const { uploadUrl, assetUrl, headers: hdrs } = fu.uploadFile;
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000');
  for (const h of hdrs ?? []) {
    headers.set(h.key, h.value);
  }
  const put = await fetch(uploadUrl, { method: 'PUT', headers, body: buffer });
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`Storage PUT ${put.status}: ${t}`);
  }
  return assetUrl;
}

/**
 * @param {string} issueId
 * @param {string} assetUrl
 * @param {string} [title]
 */
async function createAttachment(issueId, assetUrl, title) {
  const data = await gql(
    `mutation AttachmentCreate($input: AttachmentCreateInput!) {
      attachmentCreate(input: $input) {
        success
        attachment { id url title }
      }
    }`,
    {
      input: {
        issueId,
        url: assetUrl,
        title: title ?? undefined,
      },
    },
  );
  const ac = data.attachmentCreate;
  if (!ac?.success) {
    throw new Error(`attachmentCreate failed: ${JSON.stringify(ac)}`);
  }
  return ac.attachment;
}

async function main() {
  const issueId = await getIssueUuid();
  const files = readdirSync(DEV_ROOT)
    .filter((f) => /^linear-upload-attach-\d+\.payload\.json$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const name of files) {
    if (name.includes('attach-2.')) {
      console.log(`Skip ${name} (Ref 2 already on issue).`);
      continue;
    }
    const raw = stripBom(readFileSync(join(DEV_ROOT, name), 'utf8'));
    /** @type {{ issue: string; base64Content: string; filename: string; contentType: string; title?: string }} */
    const p = JSON.parse(raw);
    if (p.issue !== ISSUE_IDENTIFIER) {
      console.log(`Skip ${name} (issue ${p.issue}).`);
      continue;
    }
    const buf = Buffer.from(p.base64Content, 'base64');
    process.stdout.write(`${name} (${buf.length} bytes) ... `);
    const assetUrl = await uploadToLinearStorage(buf, p.contentType, p.filename);
    const att = await createAttachment(issueId, assetUrl, p.title);
    console.log(`OK ${att.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
