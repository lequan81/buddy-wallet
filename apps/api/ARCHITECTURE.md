# ElysiaJS Functional Programming Architecture

## Overview

This document describes the backend architecture following ElysiaJS functional programming principles with schema-first validation, pure functions, and modular composition. The architecture prioritizes data-oriented programming over object-oriented patterns.

## Core Principles

1. **Functional Programming**: Pure functions with no side effects in service layer
2. **Schema-First Validation**: TypeBox schemas define the single source of truth for validation
3. **Minimal Glue Code**: Handlers only extract data, call services, return/throw errors
4. **Modular Composition**: Elysia plugins for composable module structure
5. **Kebab-Case Naming**: All files use `abc.def.ts` naming convention (no PascalCase)

## Directory Structure

```
src/
├── index.ts                    # Application entry point (minimal)
├── bootstrap.ts                # Single source of truth for app assembly
├── config/                     # Configuration files
│   ├── app.ts                  # App configuration
│   ├── auth.ts                 # Auth configuration
│   ├── database.ts             # Database configuration
│   └── index.ts                # Config barrel
├── providers/                  # Provider instances (no DI container)
│   ├── db/                     # Database instance (Drizzle)
│   ├── redis/                  # Redis connection and plugin
│   └── telemetry-plugin/       # OpenTelemetry integration
├── commons/                    # Shared utilities
│   ├── security/               # Auth, password, and permission helpers
│   ├── http/                   # HTTP middleware and response utilities
│   │   ├── response.ts         # apiError and apiSuccess helpers
│   │   └── index.ts
│   └── validation/             # Validation helpers
├── modules/                    # Feature modules (ElysiaJS plugins)
│   ├── auth/                   # Registration, login, session mgmt
│   ├── debts/                  # Debt and payment tracking
│   ├── user/                   # User profile and admin mgmt
│   ├── storage/                # File upload and management
│   ├── system/                 # Health, info, and root routes
│   ├── bank/                   # Bank account management
│   ├── notification/           # Push and system notifications
│   └── data/                   # Import/Export functionality
└── repositories/               # Data access layer (kebab-case)
    └── database/               # Database-specific repositories
```

## Module Structure

Each module follows this consistent structure:

### 1. schema.ts - TypeBox Schemas (Single Source of Truth)
Defines validation and OpenAPI documentation metadata.

### 2. services/ - Pure Functions (Business Logic)
Pure functions that perform transformations, calculations, or validations. Ideally side-effect free.

### 3. handlers/ - Glue Code (Minimal Logic)
Functional exports that orchestrate the flow:
1. Extract data from context (body, params, query, user)
2. Call service functions for logic
3. Interact with repositories for data
4. Return standardized response using `apiSuccess` or `apiError`

### 4. routes.ts - Route Definitions
Defines the endpoints, links them to handlers, and applies TypeBox schemas.

### 5. index.ts - Module Assembly
Exports a unified Elysia plugin for the module.

## Error Handling

Standardized error codes from `@repo/errors` are used throughout the application. Handlers are responsible for setting appropriate HTTP status codes.

```typescript
import { BE_ERRORS } from '@repo/errors';

set.status = 404;
return BE_ERRORS.USER_NOT_FOUND;
```

## Logic Type Classification

Every file should have a `@logicType` JSDoc annotation:

| Type | Responsibility |
|------|---------------|
| `http` | Request handling, validation, response formatting, route definitions |
| `backend` | Orchestration, coordination, business logic orchestration |
| `infrastructure` | Data persistence, external APIs, message queues |

## Migration Status (Complete)

| Module | Status |
|--------|--------|
| auth | ✅ Complete |
| debts | ✅ Complete |
| user | ✅ Complete |
| storage | ✅ Complete |
| system | ✅ Complete |
| bank | ✅ Complete |
| notification | ✅ Complete |
| data | ✅ Complete |

| Legacy Directory | Status |
|-----------------|--------|
| `src/app/` | 🗑️ Deleted |
| `src/lib/` | 🗑️ Deleted |
| `src/routes/` | 🗑️ Deleted |
| `src/types/` | 🗑️ Deleted |

## File Naming Convention

All files use kebab-case with `.ts` extension:
- ✅ `auth.service.ts`
- ✅ `user.handler.ts`
- ✅ `debt.repo.ts`

## Best Practices

1. **Pure Functions**: Keep services pure and testable.
2. **Schema-First**: Always define TypeBox schemas first.
3. **Minimal Handlers**: Handlers should be thin "glue code".
4. **Direct Imports**: Import providers directly, avoid complex DI containers.
5. **Logic Isolation**: Keep business logic out of the database layer.
