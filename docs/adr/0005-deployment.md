# ADR 0005: Local and hosted services

Status: Accepted

Docker Compose is the canonical local PostgreSQL and Redis prerequisite. `pnpm stack` starts the dependencies, waits for their health checks, and launches the API, fixture server, and web client. Offline play is bundled into the client and remains available if optional development services are unavailable after load. Hosted deployment topology is intentionally deferred until multiplayer work.
