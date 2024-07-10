# Set default shell for commands to bash (important for some commands)
SHELL := /bin/bash

# Define your Docker Compose project name
COMPOSE_PROJECT_NAME := hoyolab-auto  

# Define the Docker Compose file to use
COMPOSE_FILE := docker-compose.yml

# Target: build (Builds your Docker image)
build:
	docker-compose -f $(COMPOSE_FILE) build

# Target: up (Starts your application in the background)
up:
	docker-compose -f $(COMPOSE_FILE) up -d

# Target: down (Stops and removes containers, networks)
down:
	docker-compose -f $(COMPOSE_FILE) down

# Target: restart (Restarts your application)
restart: down up

# Target: logs (Follows application logs)
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f instance 

# Target: exec (Execute a command inside the running container)
exec:
	docker-compose -f $(COMPOSE_FILE) exec instance bash

# Target: update (Rebuild and restart with latest changes)
update: build restart 

# Target: help (Display help message)
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  build       Build the Docker image"
	@echo "  up          Start the application in the background"
	@echo "  down        Stop and remove containers, networks, volumes"
	@echo "  restart     Restart the application (down & up)"
	@echo "  logs        View application logs"
	@echo "  exec        Open a Bash shell inside the running container"
	@echo "  update      Rebuild the image and restart the application"
	@echo "  help        Show this help message"