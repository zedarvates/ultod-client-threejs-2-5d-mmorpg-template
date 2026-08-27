# Sprite Assets Provenance

Status: `review_only` (2026-08-27)

This directory defines the public client sprite asset ingestion boundary.

## Ingestion Rules

1. **Asset Factory Origin**: Every sprite pack must originate from a verified Asset Factory run with a finalized `uo.asset-manifest/v2` and passing `required_gates`.
2. **Review Only**: Automated generation alone does not publish assets. An artist review must explicitly approve the contact sheet and visual quality.
3. **Explicit Redistribution License**: No binary sprite atlas or texture file may be committed to this repository without explicit redistribution terms.
4. **Fail-Closed Fallback**: The client runtime must always preserve geometric capsule fallbacks if a sprite pack is missing, unreviewed, or corrupted.

