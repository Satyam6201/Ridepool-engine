# Ride Dispatch Platform

A small microservice ride dispatch and pooling system.

## Setup & Running

Start all services with one command:

```bash
make up
```

Or with Docker Compose:

```bash
docker compose up --build -d
```

Services are only accessible through the Nginx gateway at `http://localhost`:

- Web app: `http://localhost/`
- Gateway health: `http://localhost/health`
- Auth service: `http://localhost/api/auth/health`
- Driver service: `http://localhost/api/drivers/health`
- Trip service: `http://localhost/api/trips/health`
- Matching service: `http://localhost/api/matching/health`
- Pricing service: `http://localhost/api/pricing/health`
- Realtime service: `http://localhost/api/realtime/health`

## Commands

- `make up` - build and run containers in background
- `make down` - stop and remove containers
- `make logs` - stream logs from all containers
- `make test` - run tests in all backend containers
