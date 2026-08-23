# Publication Checklist

Before any code or data is pushed:

- Approve the architecture and server compatibility gates.
- Build an isolated file-level allowlist, currently [PUBLIC-EXTRACTION-DESIGN.md](PUBLIC-EXTRACTION-DESIGN.md).
- Confirm every file's ownership and license.
- Exclude server code, binaries, production configuration and protocol dumps.
- Exclude credentials, endpoints, identities, telemetry and player data.
- Exclude commercial, administration and billing integrations.
- Exclude unreviewed assets and third-party references.
- Replace source data with minimal synthetic fixtures.
- Scan the extract for secrets.
- Validate a fresh clone using only documented dependencies.
- Document the exact proof boundary and all untested environments.

If any item is unresolved, publication remains blocked.
