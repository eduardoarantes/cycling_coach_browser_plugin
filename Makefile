# TrainingPeaks Browser Extension - Makefile
# Common commands for development, testing, and building

.PHONY: help install dev build lint test clean

# Default target - show help
help:
	@echo "TrainingPeaks Browser Extension - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install       Install dependencies"
	@echo "  make dev          Start development server with HMR"
	@echo "  make build        Build production bundle"
	@echo "  make preview      Preview production build"
	@echo ""
	@echo "Quality:"
	@echo "  make lint         Run ESLint"
	@echo "  make format       Format code with Prettier"
	@echo "  make type-check   Run TypeScript type checking"
	@echo "  make check        Run all checks (lint + type-check)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         Run tests in watch mode"
	@echo "  make test-unit    Run unit tests once"
	@echo "  make test-e2e     Run E2E tests (headed mode)"
	@echo "  make test-e2e-ui  Run E2E tests in UI mode"
	@echo "  make setup-e2e    Install Playwright browsers"
	@echo "  make coverage     Generate coverage report"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        Remove build artifacts"
	@echo "  make clean-all    Remove build artifacts and node_modules"
	@echo "  make fresh        Clean reinstall (clean-all + install)"
	@echo ""
	@echo "Extension:"
	@echo "  make load         Build and show Chrome extension load instructions"
	@echo "  make package      Create distributable ZIP file"
	@echo ""

# Installation
install:
	@echo "Installing dependencies..."
	npm install

# Development
dev:
	@echo "Starting development server..."
	npm run dev

build:
	@echo "Building production bundle..."
	npm run build

preview:
	@echo "Previewing production build..."
	npm run preview

# Quality checks
lint:
	@echo "Running ESLint..."
	npm run lint

format:
	@echo "Formatting code with Prettier..."
	npm run format

type-check:
	@echo "Running TypeScript type checking..."
	npm run type-check

check: lint type-check
	@echo "✅ All quality checks passed!"

# Testing
test:
	@echo "Running tests in watch mode..."
	npm test

test-unit:
	@echo "Running unit tests..."
	npm run test:unit

test-components:
	@echo "Running component tests..."
	npm run test:components

test-e2e: build
	@echo "Running E2E tests (headed mode - you'll see browser)..."
	npx playwright test

test-e2e-ui: build
	@echo "Running E2E tests in UI mode..."
	npx playwright test --ui

test-e2e-debug: build
	@echo "Running E2E tests in debug mode..."
	npx playwright test --debug

setup-e2e:
	@echo "Installing Playwright browsers..."
	npx playwright install chromium

coverage:
	@echo "Generating coverage report..."
	npm run coverage

# Utilities
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -rf .vite
	rm -rf coverage

clean-all: clean
	@echo "Removing node_modules..."
	rm -rf node_modules
	rm -rf package-lock.json

fresh: clean-all install
	@echo "✅ Fresh installation complete!"

# Extension management
load: build
	@echo "✅ Extension built successfully!"
	@echo ""
	@echo "To load in Chrome:"
	@echo "1. Open chrome://extensions/"
	@echo "2. Enable 'Developer mode' (top-right toggle)"
	@echo "3. Click 'Load unpacked'"
	@echo "4. Select the 'dist' folder: $(PWD)/dist"
	@echo ""

package: build
	@echo "Creating distribution package..."
	cd dist && zip -r ../trainingpeaks-extension.zip .
	@echo "✅ Package created: trainingpeaks-extension.zip"
	@echo "Size: $$(du -h trainingpeaks-extension.zip | cut -f1)"

# Pre-commit checks (useful for manual verification)
pre-commit: check test-unit
	@echo "✅ Pre-commit checks passed!"

# Full CI check
ci: install lint type-check test-unit build
	@echo "✅ All CI checks passed!"
