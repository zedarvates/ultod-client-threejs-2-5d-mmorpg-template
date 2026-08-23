# Pinned JSON Templates

Status: `decision`. The client consumes versioned JSON templates published in
[ultod-json-template-registry](https://github.com/zedarvates/ultod-json-template-registry).

## Rules of consumption

1. Every template must be explicitly pinned by its SemVer and SHA-256 hash.
2. Templates are vendor-audited; automatic runtime download is forbidden.
3. Templates describe presentation hints only; they never grant currency, damage,
   or abilities.
4. Missing or mismatching hashes fail closed immediately.
