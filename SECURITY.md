# Security Policy

## Supported versions

Only the `main` branch receives security fixes. There are no tagged releases
yet.

## Reporting a vulnerability

Report privately by email to **daftpunk.wav@outlook.com**. Please do not open
public issues for security reports.

Include a description of the issue, reproduction steps or a proof of concept,
the affected package paths, and your assessment of severity. You will receive
an acknowledgment within 7 days and status updates while a fix is in
progress.

## Scope notes

Security-relevant surfaces, in rough priority order:

- **BYOK encryption / decryption** —
  `packages/foundation/src/byokCrypto.ts`: AES-GCM encryption of user-supplied
  provider keys, key derivation from `BYOK_ENCRYPTION_KEY` or `JWT_SECRET`,
  and authentication-tag validation.
- **JWT signing and rotation** —
  `packages/foundation/src/jwt.ts`: access + refresh token issuance, refresh
  rotation, and revocation store interaction.
- **URL / SSRF guard for BYOK provider calls** —
  `packages/foundation/src/byokUrlPolicy.ts` (and helpers in
  `services/llm`): outbound URL validation applied before provider requests.
- **Rate limiting and request body caps** —
  `packages/foundation/src/middleware/*` and the per-route
  `express-rate-limit` configuration in each service's `routes/`.
- **Annotation ACL enforcement** —
  `services/content/src/services/annotationAcl.ts`: visibility filtering
  (guest → approved only) and moderation gating.
- **Tool access control (panel Agent)** —
  `services/agent/src/lib/tools/`: tool allowlist and per-user tool gating
  applied before each `tool_call` SSE event.
- **Hover-answer sanitization** —
  `packages/contracts/src/hoverSanitize.ts`: detection and rejection of
  malformed / suspicious hover-explain payloads before they are cached or
  returned to the client.

Findings outside the surfaces above are equally welcome.
