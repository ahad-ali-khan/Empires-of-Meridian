---
name: postgres-best-practices
description: PostgreSQL schemas and migrations for RTS accounts, history, lobbies, and ratings.
---

# PostgreSQL best practices

Use explicit primary keys, `NOT NULL` semantic constraints, UTC `timestamptz`, and
indexes for real query paths (including foreign keys). Keep match simulation state out
of ad-hoc JSON blobs; use versioned schemas and reversible, tested migrations. Never
embed connection strings or run automatic remote migrations. Apply least privilege and
separate account/social data from match telemetry retention policies.
