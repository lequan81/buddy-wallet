# HTTP Plugins

ElysiaJS plugins that extend the framework's functionality via `.derive()` and `.macro()`.

Per Laravel + JS Architecture:
- **Plugins** → Extend Elysia with custom context/methods (`.derive()`, `.macro()`)
- **Middlewares** → Process requests/responses (traditional middleware pattern)

## Structure

```
app/Http/Plugins/
├── Authentication/
│   ├── Actor.ts          # Provides 'actor' to context
│   ├── Jwt.ts            # JWT handling
│   └── SessionAuth.ts    # Session-based auth
├── Authorization/
│   └── AccessControl.ts  # Permission macros
└── index.ts              # Central exports
```

## Usage

```typescript
import { actorPlugin } from '@/app/Http/Plugins/Authentication/Actor';
import { accessControlPlugin } from '@/app/Http/Plugins/Authorization/AccessControl';

export const api = new Elysia()
  .use(actorPlugin)
  .use(accessControlPlugin)
  .get('/user', ({ actor }) => actor);
```
