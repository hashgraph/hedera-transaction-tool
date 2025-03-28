# Variables
PACKAGE_MANAGER := pnpm
EXECUTABLE_PATH := ./node_modules/.bin
RELEASE_DIR := ./release

# Detect the current platform
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
  CURRENT_PLATFORM := linux
endif
ifeq ($(UNAME_S),Darwin)
  CURRENT_PLATFORM := mac
endif
ifeq ($(OS),Windows_NT)
  CURRENT_PLATFORM := windows
endif

# Commands
CLEAN := rm -rf dist dist-electron coverage release
CLEAN_MODULES := rm -rf node_modules

PREBUILD_ELECTRON := $(EXECUTABLE_PATH)/electron-builder install-app-deps
GENERATE_PRISMA_CLIENT := $(EXECUTABLE_PATH)/prisma generate
GENERATE_NOTICE := node ../notice-gen/index.js

LINT := $(EXECUTABLE_PATH)/eslint . --fix
FORMAT := $(EXECUTABLE_PATH)/prettier --write .
TYPECHECK_NODE := $(EXECUTABLE_PATH)/tsc --noEmit -p tsconfig.node.json --composite false
TYPECHECK_VUE := $(EXECUTABLE_PATH)/vue-tsc --noEmit -p tsconfig.web.json --composite false
BUILD_VITE := $(EXECUTABLE_PATH)/vite build
BUILD_APP := $(EXECUTABLE_PATH)/electron-builder
TEST := $(EXECUTABLE_PATH)/vitest --config src/tests/vitest.config.main.ts --passWithNoTests

# PHONY targets
.PHONY: default clean install start build build\:mac build\:linux build\:windows build/current build\:current open test test\:watch test\:coverage test\:watch\:coverage format typecheck help

# Default make command
default: install build/current open

# Clean up generated files & dependencies
clean:
	@echo "Cleaning up..."
	$(CLEAN_MODULES)
	$(CLEAN)

# Install project dependencies
install:
	@echo "Cleaning old dependencies..."
	$(CLEAN_MODULES)
	@echo "Installing dependencies..."
	$(PACKAGE_MANAGER) install
	@echo "Prebuilding dependencies..."
	$(PREBUILD_ELECTRON)
	@echo "Generating Prisma Client..."
	$(GENERATE_PRISMA_CLIENT)
	@echo "Generating NOTICE..."
	$(GENERATE_NOTICE)

# Start the development server
start:
	@echo "Starting the development server..."
	$(PACKAGE_MANAGER) vite

# Build the Vite project
build:
	@echo "Cleaning up..."
	$(CLEAN)
	@echo "\nGenerating Prisma Client..."
	$(GENERATE_PRISMA_CLIENT)
	@echo "\nTypechecking..."
	$(TYPECHECK_NODE)
	$(TYPECHECK_VUE)
	@echo "\nBuilding main, preload and renderer ..."
	$(BUILD_VITE)

# Build the Electron app for macOS
build\:mac: build
	@echo "Building the project for macOS..."
	$(BUILD_APP) --mac

# Build the Electron app for Linux
build\:linux: build
	@echo "Building the project for Linux..."
	$(BUILD_APP) --linux

# Build the Electron app for Windows
build\:windows: build
	@echo "Building the project for Windows..."
	$(BUILD_APP) --windows

# Build the Electron app for the current platform
build/current build\:current: build
	@echo "Building the project for the current platform ($(CURRENT_PLATFORM))..."
	$(BUILD_APP) --$(CURRENT_PLATFORM)

# Open the release directory
open:
	@echo "Opening the release directory..."
	@xdg-open $(RELEASE_DIR) || open $(RELEASE_DIR)

# Run tests
test:
	@echo "Running tests..."
	$(TEST)

# Run tests in watch mode
test\:watch:
	@echo "Running tests in watch mode..."
	$(TEST) --watch

# Run tests with coverage
test\:coverage:
	@echo "Running tests with coverage..."
	$(TEST) --coverage

# Run tests in watch mode with coverage
test\:watch\:coverage:
	@echo "Running tests with coverage..."
	$(TEST)  --watch --coverage

# Apply code styling
format:
	@echo "Linting and formatting..."
	$(LINT)
	$(FORMAT)

# Typecheck the project
typecheck:
	@echo "Typechecking..."
	$(TYPECHECK_NODE)
	$(TYPECHECK_VUE)

# List all available make commands
help:
	@echo "Usage:"
	@echo "  make clean         Clean up node_modules and generated files"
	@echo "  make install       Install project dependencies"
	@echo "  make start         Start the development server"
	@echo "  make build:mac     Build the application for macOS"
	@echo "  make build:linux   Build the application for Linux"
	@echo "  make build:windows Build the application for Windows"
	@echo "  make build:current Build the application for the current OS"
	@echo "  make open          Open the release directory"
	@echo "  make test          Run tests"
	@echo "  make test:watch    Run tests in watch mode"
	@echo "  make test:coverage Run tests with coverage"
	@echo "  make test:watch:coverage Run tests in watch mode with coverage"
	@echo "  make format        Apply code styling using eslint and prettier"
	@echo "  make typecheck     Typecheck the project"
	@echo "  make help          Show this help message"
