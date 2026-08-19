# JSON Template Registry Contract

The future web client may consume published snapshots from [ultod-json-template-registry](https://github.com/zedarvates/ultod-json-template-registry), but the registry is not a live game database or an authoritative server configuration.

## Consumption rules

- Pin an explicit template version.
- Resolve the file through templates/catalog.json.
- Verify its SHA-256 before use.
- Treat experimental status as unstable.
- Treat an empty compatibility list as no certified compatibility.
- Vendor a reviewed snapshot for deterministic web builds.
- Never download or activate templates automatically at runtime without verification.
- Never infer ownership or asset rights from a JSON identifier.
- Validate all gameplay values and permissions on the server.

## Client boundary

Templates may describe presentation, labels or synthetic local fixtures. They must not grant inventory, currency, progression, permissions, damage, movement speed or any other authoritative state.

## Upgrade rule

An upgrade requires a reviewed catalog diff, a new pinned version and explicit compatibility evidence. A matching filename alone is not compatibility.

## Failure behavior

Missing versions, unknown hashes, malformed JSON or unsupported compatibility must fail closed. The client should report unsupported data rather than silently selecting another version.
