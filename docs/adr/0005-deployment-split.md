# ADR 0005: deployment split

Status: proposed for Milestone 2+

The web shell, API, long-running authoritative rooms, workers, PostgreSQL, Redis, and
object storage have separate responsibilities. No ranked match depends on one general
serverless function remaining alive. Local Postgres/Redis orchestration is deferred
until a container runtime is available.
