.PHONY: setup dev up down logs setup-models clean

setup:
	@echo "Running setup script..."
	@bash scripts/setup.sh

dev: up
	@echo "Docker compose services started."
	@echo "To start the frontend dev server, run:"
	@echo "cd frontend && npm run dev"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

setup-models:
	@echo "Pulling base model and creating Jarvis modelfile..."
	docker compose exec ollama ollama pull llama3.1:8b
	docker compose exec ollama ollama create jarvis -f /app/agent/modelfile # Assuming agent is mounted or modelfile copied

clean: down
	@echo "Cleaning up containers and volumes..."
	docker compose down -v
	rm -rf .env
