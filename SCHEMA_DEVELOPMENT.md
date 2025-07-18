# Schema Development Workflow

This guide explains how to properly handle Prisma schema changes in the Docker development environment.

## The Problem

When you change the Prisma schema, several things need to happen in the correct order:

1. Generate the Prisma client with new types
2. Push the schema changes to the database
3. Restart the backend to use the new client
4. Ensure TypeScript compilation picks up the new types

Previously, doing this manually often led to:

- Stale Prisma client types
- TypeScript compilation errors
- Backend crashes due to schema mismatches
- Inconsistent database state

## The Solution

We've created automated scripts and npm commands to handle this workflow reliably.

## Quick Reference

### For Schema Changes (Most Common)

```bash
npm run schema:update
# OR
./scripts/update-schema.sh
```

**Use this when:** You've modified `backend/prisma/schema.prisma`

### For Quick Client Regeneration

```bash
npm run schema:generate
# OR
./scripts/prisma-dev.sh
```

**Use this when:** You need to regenerate the Prisma client without schema changes

### For Database Operations

```bash
npm run prisma:studio      # Open Prisma Studio
npm run prisma:push        # Push schema without full restart
npm run prisma:reset       # Reset database (careful!)
```

## Complete Workflow

### 1. Making Schema Changes

1. Edit `backend/prisma/schema.prisma`
2. Run the schema update:
   ```bash
   npm run schema:update
   ```
3. The script will:
   - Stop the backend service
   - Generate the new Prisma client
   - Push schema changes to the database
   - Regenerate the client (to pick up any DB changes)
   - Restart the backend service
   - Show you the logs

### 2. Development Iteration

If you're just working on code (no schema changes):

```bash
npm run dev              # Start everything
npm run logs:backend     # Watch backend logs
```

### 3. Troubleshooting

#### Backend won't start after schema change

```bash
npm run logs:backend     # Check what's wrong
npm run schema:update    # Try the full workflow again
```

#### Database connection issues

```bash
npm run stop             # Stop everything
npm run dev:clean        # Clean restart
```

#### Nuclear option (reset everything)

```bash
npm run stop:all         # Stop and remove volumes
npm run prisma:reset     # Reset database
npm run dev              # Start fresh
```

## Understanding the Scripts

### `scripts/update-schema.sh`

**Full schema update workflow:**

- Checks Docker services are running
- Stops backend to avoid conflicts
- Generates Prisma client
- Pushes schema to database
- Regenerates client (important!)
- Restarts backend
- Provides status feedback

### `scripts/prisma-dev.sh`

**Quick client regeneration:**

- Ensures PostgreSQL is running
- Regenerates Prisma client only
- Useful when you haven't changed the schema

## Best Practices

### 1. Always Use the Scripts

Don't run Prisma commands manually in containers - use the scripts or npm commands.

### 2. Schema Change Workflow

```bash
# 1. Make your schema changes
vim backend/prisma/schema.prisma

# 2. Update schema (this handles everything)
npm run schema:update

# 3. Test your changes
curl http://localhost:3000/api/your-endpoint
```

### 3. Before Committing

```bash
# Ensure everything is working
npm run dev:clean
npm run logs:backend

# Your backend should start without errors
```

### 4. Working with Others

- Always commit schema changes atomically
- Document breaking changes in PR descriptions
- Run `npm run schema:update` after pulling schema changes

## Common Commands Quick Reference

| Command                   | Purpose                     | When to Use                  |
| ------------------------- | --------------------------- | ---------------------------- |
| `npm run schema:update`   | Full schema update workflow | After changing schema.prisma |
| `npm run schema:generate` | Quick client regeneration   | When client is out of sync   |
| `npm run dev`             | Start all services          | Normal development           |
| `npm run dev:clean`       | Clean restart               | When things are broken       |
| `npm run prisma:studio`   | Open database GUI           | Exploring/debugging data     |
| `npm run logs:backend`    | Watch backend logs          | Debugging issues             |
| `npm run stop`            | Stop all services           | End of day                   |

## Environment Variables

Make sure your `.env` file has:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=dbname
```

## Troubleshooting Common Issues

### "Object literal may only specify known properties"

This means the Prisma client hasn't been regenerated. Run:

```bash
npm run schema:update
```

### Backend container exits immediately

Check logs first:

```bash
npm run logs:backend
```

Usually means TypeScript compilation failed due to stale Prisma types.

### Database connection refused

Ensure PostgreSQL is running:

```bash
docker compose ps
npm run dev:backend  # Start just backend + postgres
```

### Old data after schema changes

The scripts use `--accept-data-loss` flag. For production-like migrations:

```bash
# Use Prisma migrations instead
docker compose --profile tools run --rm prisma migrate dev
```

## Pro Tips

1. **Keep scripts updated**: If you add new Prisma features, update the scripts
2. **Use npm scripts**: They're shorter and more memorable than Docker commands
3. **Watch the logs**: Always check `npm run logs:backend` after schema changes
4. **Atomic commits**: Commit schema + code changes together
5. **Test thoroughly**: Schema changes can break existing functionality

## Next Steps

- Set up automatic schema validation in CI/CD
- Add database seeding scripts
- Consider Prisma migrations for production
- Set up schema versioning strategy
