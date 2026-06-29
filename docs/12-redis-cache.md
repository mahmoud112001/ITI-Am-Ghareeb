# Redis Cache

## Overview

This project uses Redis as a lightweight cache layer for frequently requested route and station data. Redis helps reduce repeated MongoDB reads and improves response times for common lookup operations.

## Why Redis is used

- Reduce MongoDB load for repeated requests
- Speed up route searches and station lookups
- Keep the application resilient if cache access briefly fails
- Preserve MongoDB as the source of truth

## Redis setup

### Prerequisites

- Redis server running locally or remotely
- Environment variable:
  - REDIS_URL=redis://localhost:6379

### Local development

If Redis is installed locally, it can be started with:

```bash
redis-server
```

If Redis is running in Docker, a typical command is:

```bash
docker run --name am-ghareeb-redis -p 6379:6379 -d redis
```

## Server integration

The Redis client is initialized in:

- [server/src/config/redis.js](../server/src/config/redis.js)

The cache helpers live in:

- [server/src/utils/cache.js](../server/src/utils/cache.js)

## Cache usage patterns

### Read from cache

Use the cache helper to safely read a value:

```js
const { getCache } = require("../utils/cache");
const data = await getCache("stations");
```

### Write to cache

Use the cache helper to safely store a value with a TTL:

```js
const { setCache } = require("../utils/cache");
await setCache("stations", stations, 3600);
```

### Delete from cache

Invalidate stale data after updates:

```js
const { deleteCache } = require("../utils/cache");
await deleteCache("route:123");
```

## Current cache usage

The current implementation uses Redis for:

- station lists
- route detail lookups
- route search results

## Safety behavior

The cache layer is designed to be non-blocking:

- Redis failures do not crash the server
- JSON parsing issues are handled safely
- MongoDB remains the source of truth
- users still receive normal responses even if cache access fails

## Example cache keys

- stations
- route:123
- route:123:forward
- search:alexandria:el-manshia

## Notes

- Cache entries should be invalidated after route updates, deletes, or other data changes.
- TTL values should be chosen based on how often the underlying data changes.
- Redis should be treated as a performance optimization, not the primary data store.
