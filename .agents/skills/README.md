# Empires of Meridian skill policy

Skills in this directory are project-owned, version-controlled guidance. They are
documentation only: no bundled executable, network request, credential lookup, or
automatic package installation is permitted. A task may access a network, a secret,
or an external service only when the user explicitly asks and the task requires it.

`rts-*` skills are the project's source of truth. They override imported reference
guidance whenever determinism, authority, the performance budget, accessibility, or
IP compliance is at stake.

## Upstream audit — 2026-09-15

The following local reference skills are concise, sanitized derivations of the
audited upstream `SKILL.md` files; they do not vendor upstream scripts, examples, or
dependencies. Pins are immutable git commit IDs.

| Source | Pin | Local skills |
| --- | --- | --- |
| CloudAI-X/threejs-skills | `b1c623076c661fc9b03dac19292e825a5d106823` | `threejs-*` |
| anthropics/skills | `34040c9c568585f6929bedeaad110ad08f079624` | `webapp-testing` |
| obra/superpowers | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | six workflow skills |
| wshobson/agents | `4236bb91f8395b0435f1d8b8baf9e8e4c69a8620` | `postgres-best-practices`, `sast-configuration` |

Review result: CloudAI-X includes no skill-local executables, but its loader
guidance contains remote CDN and `fetch` examples, so this project replaces it with
a local-assets-only version. Anthropic's web-testing helper uses `shell=True`; it is
not included. Superpowers' debugging text includes a secret-availability command;
that instruction is not included. Wshobson's selected skills include unpinned
networked tool-install examples; these are replaced with offline-first guidance.

`three-best-practices` and `docker-expert` were **not installed**: the supplied
source names did not identify a pin-able skill path at the audited revisions. Do not
substitute a similarly named marketplace package without a new review.
