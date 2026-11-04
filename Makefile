.PHONY: up down logs test

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose exec -T auth-service npm test
	docker compose exec -T driver-service npm test
	docker compose exec -T trip-service npm test
	docker compose exec -T matching-service npm test
	docker compose exec -T pricing-service npm test
	docker compose exec -T realtime-service npm test
