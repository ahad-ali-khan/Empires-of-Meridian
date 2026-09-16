---
name: sast-configuration
description: Offline-first static security checks for auth, lobby APIs, and uploads.
---

# SAST configuration

Start with an offline, version-pinned scanner configuration checked into the project.
Define language scope, generated-code exclusions, severity gate, suppression format,
and custom rules for secrets, unsafe deserialization, auth bypasses, uploads, and
untrusted lobby/chat input. A scan must not upload source or consume credentials by
default; external dashboards and registry rules require explicit approval.
