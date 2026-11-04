# Ride Dispatch Platform (Mini Uber Pool)

A microservice-based ride dispatch and pooling platform.

## Architecture

The system consists of the following components:

- gateway: Nginx reverse proxy and API gateway. The only service exposing host ports.
- frontend: React SPA built with Vite, React Router, Axios, Socket.io client, and Leaflet.
- auth-service: User authentication and token management (Port 3001).
- driver-service: Driver status, availability, and location management (Port 3002).
- trip-service: Ride request lifecycle and pooling state (Port 3003).
- matching-service: Pool matching logic and dispatch coordination (Port 3004).
- pricing-service: Dynamic fare calculation for pooled trips (Port 3005).
- realtime-service: WebSocket gateway via Socket.io with Redis adapter (Port 3006).
- shared: Local shared package providing logger, error classes, env validation, Kafka client, and Redis client.
- Infrastructure: MongoDB 7, Redis 7, and Apache Kafka 3.7 (KRaft mode).

## Prerequisites

- Docker Engine 24.0+ and Docker Compose v2+
- Make (optional, commands can be run directly via docker compose)

## Quick Start (One Command)

To build and start the entire stack in the background:

```bash
make up
```

Alternatively, using Docker Compose directly:

```bash
docker compose up --build -d
```

Once running:
- Web Application: http://localhost
- Gateway Health Check: http://localhost/health
- Auth Service Health Check: http://localhost/api/auth/health
- Driver Service Health Check: http://localhost/api/drivers/health
- Trip Service Health Check: http://localhost/api/trips/health
- Matching Service Health Check: http://localhost/api/matching/health
- Pricing Service Health Check: http://localhost/api/pricing/health
- Realtime Service Health Check: http://localhost/api/realtime/health

## Viewing Logs

Follow logs across all containers:

```bash
make logs
```

Or:

```bash
docker compose logs -f
```

## Running Tests

Run unit and health tests across all running services:

```bash
make test
```

## Stopping the Platform

Stop and remove all containers, networks, and keep persistent data:

```bash
make down
```

To remove persistent volumes as well:

```bash
docker compose down -v
```
