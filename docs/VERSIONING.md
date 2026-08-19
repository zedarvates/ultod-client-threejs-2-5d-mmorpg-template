# Versioning Policy

This repository will use Semantic Versioning only after an original runnable starter exists.

## Before the first runnable starter

- Documentation changes remain on the main branch without release tags.
- Repository creation and documentation commits are not software releases.
- No compatibility promise is implied by a commit hash or GitHub template status.

## Planned version rules

- 0.y.z: experimental starter APIs and layouts may change.
- 1.y.z: stable public starter contract with documented compatibility.
- Patch: compatible documentation or implementation correction.
- Minor: backward-compatible capability addition.
- Major: incompatible public contract, project layout or integration change.

## Compatibility is separate

A version number never proves compatibility. Every supported combination must be listed with its Three.js version, browser engines, server protocol version and tested runtime. An absent combination is unsupported.

JSON templates use their own versions in the external registry. A client release must pin exact registry versions and SHA-256 values rather than inheriting the latest registry state.

## Tagging gate

A tag may be created only after the publication checklist, fresh-clone validation, secret scan, license review and named compatibility evidence pass. Documentation-only state must not receive a runnable release tag.
