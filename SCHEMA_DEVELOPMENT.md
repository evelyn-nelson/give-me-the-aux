# Schema Development Workflow

This guide explains how to properly handle Prisma schema changes in the Docker development environment **with full editor integration**.

## The Problem We Solved

When you change the Prisma schema, several things need to happen in the correct order:

1. Generate the Prisma client with new types **on the host** (for your text editor)
2. Generate the Prisma client **in the container** (for runtime)
3. Push the schema changes to the database
4. Restart the backend to use the new client
5. Ensure TypeScript compilation picks up the new types

**Previous issues:**

- Prisma client was only generated inside Docker containers
- Text editors couldn't see updated types (reading from host filesystem)
- TypeScript language server used stale types
- Volume mounting isolated container types from host

**Current solution:**

- Generate Prisma client on **BOTH** host and container
- Host generation ensures your editor sees new types immediately
- Container generation ensures runtime has correct client
- Scripts handle both automatically

## Quick Reference

### For Schema Changes (Most Common)

```bash
npm run schema:update
# OR
./scripts/update-schema.sh
```

**Use this when:** You've modified `backend/prisma/schema.prisma`

**What it does:**

- ✅ Generates client on HOST (for editor)
- ✅ Generates client in CONTAINER (for runtime)
- ✅ Pushes schema to database
- ✅ Restarts backend service
- ✅ Both TypeScript editor and runtime stay in sync

### For Quick Client Regeneration

```bash
npm run schema:generate
# OR
./scripts/prisma-dev.sh
```

**Use this when:** You need to regenerate the Prisma client without schema changes

**What it does:**

- ✅ Generates client on HOST (for editor)
- ✅ Generates client in CONTAINER (for runtime)
- ✅ No database changes

### For Database Operations

```bash
npm run prisma:studio      # Open Prisma Studio
npm run prisma:push        # Push schema without full restart
npm run prisma:reset       # Reset database (careful!)
```

### Backend Package Scripts

```bash
cd backend
npm run prisma:generate    # Generate client locally
npm run prisma:push        # Push schema to DB
npm run prisma:studio      # Open Prisma Studio
```

## Complete Workflow

### 1. Making Schema Changes

1. Edit `backend/prisma/schema.prisma`
2. Run the schema update:
   ```bash
   npm run schema:update
   ```
3. The script will:

   - ✅ Generate Prisma client on HOST (your editor will see new types)
   - ✅ Generate Prisma client in CONTAINER
   - ✅ Push schema changes to database
   - ✅ Regenerate both clients after DB changes
   - ✅ Restart backend service
   - ✅ Show you the logs

4. **Your text editor should immediately see the new types!**
   - If not, restart your TypeScript language server
   - Most editors: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### 2. Development Iteration

If you're just working on code (no schema changes):

```bash
npm run dev              # Start everything
npm run logs:backend     # Watch backend logs
```

### 3. Troubleshooting

#### Text editor doesn't show new types

```bash
# 1. Regenerate client on host
cd backend && npx prisma generate

# 2. Restart TypeScript language server in your editor
# VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"
# Cursor: Cmd+Shift+P → "TypeScript: Restart TS Server"

# 3. If still not working, run full update
npm run schema:update
```

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

### `scripts/update-schema.sh` - FULL WORKFLOW

**Generates client on BOTH host and container:**

1. Checks Docker services are running
2. Stops backend to avoid conflicts
3. **Generates Prisma client on HOST** (for your editor)
4. **Generates Prisma client in CONTAINER** (for runtime)
5. Pushes schema to database
6. **Regenerates both clients** (to pick up DB changes)
7. Restarts backend
8. Provides status feedback

### `scripts/prisma-dev.sh` - QUICK REGENERATION

**Fast client regeneration on both systems:**

1. Ensures PostgreSQL is running
2. **Generates Prisma client on HOST** (for your editor)
3. **Generates Prisma client in CONTAINER** (for runtime)
4. Both stay in sync

## Best Practices

### 1. Always Use the Scripts

Don't run Prisma commands manually - use the scripts or npm commands for consistency.

### 2. Schema Change Workflow

```bash
# 1. Make your schema changes
vim backend/prisma/schema.prisma

# 2. Update schema (handles both host and container)
npm run schema:update

# 3. Your editor should immediately show new types
# 4. Test your changes
curl http://localhost:3000/api/your-endpoint
```

### 3. Before Committing

```bash
# Ensure everything is working
npm run dev:clean
npm run logs:backend

# Both host and container should have same client version
```

### 4. Working with Others

- Always commit schema changes atomically
- After pulling schema changes: `npm run schema:update`
- Document breaking changes in PR descriptions

### 5. Editor Integration Tips

**VSCode/Cursor:**

- Install Prisma extension for syntax highlighting
- Use `Cmd+Shift+P` → "TypeScript: Restart TS Server" after schema changes
- Enable "typescript.preferences.includePackageJsonAutoImports": "on"

**TypeScript:**

- The scripts ensure `node_modules/@prisma/client` is always up-to-date on host
- Your tsconfig.json should include proper paths

## Common Commands Quick Reference

| Command                   | Purpose                     | When to Use                  | Editor Types Updated |
| ------------------------- | --------------------------- | ---------------------------- | -------------------- |
| `npm run schema:update`   | Full schema update workflow | After changing schema.prisma | ✅ Yes               |
| `npm run schema:generate` | Quick client regeneration   | When client is out of sync   | ✅ Yes               |
| `npm run dev`             | Start all services          | Normal development           | ➖ No change         |
| `npm run dev:clean`       | Clean restart               | When things are broken       | ➖ No change         |
| `npm run prisma:studio`   | Open database GUI           | Exploring/debugging data     | ➖ No change         |
| `npm run logs:backend`    | Watch backend logs          | Debugging issues             | ➖ No change         |

## Architecture: Host + Container Sync

```
┌─────────────────────────────────────────────────────────────┐
│                          HOST SYSTEM                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  backend/node_modules/@prisma/client/  ← YOUR EDITOR    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ↕ sync
┌─────────────────────────────────────────────────────────────┐
│                      DOCKER CONTAINER                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  /app/node_modules/@prisma/client/  ← RUNTIME          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Our scripts ensure both locations always have the same Prisma client version.**

## Troubleshooting Common Issues

### "Cannot find module '@prisma/client'"

**In editor:** Client not generated on host

```bash
cd backend && npx prisma generate
```

**At runtime:** Client not generated in container

```bash
npm run schema:generate
```

### "Object literal may only specify known properties"

Prisma client is outdated. Run:

```bash
npm run schema:update
```

### Backend container exits immediately

Check logs first:

```bash
npm run logs:backend
```

Usually means schema mismatch between host and container.

### Types appear in editor but runtime fails

Container client is outdated:

```bash
npm run schema:generate  # Regenerates both
```

### Database connection refused

Ensure PostgreSQL is running:

```bash
docker compose ps
npm run dev:backend  # Start just backend + postgres
```

## Pro Tips

1. **Editor integration**: The scripts generate types where your editor can see them
2. **Fast iteration**: Use `npm run schema:generate` for quick client updates
3. **Watch the logs**: Always check `npm run logs:backend` after schema changes
4. **Atomic commits**: Commit schema + code changes together
5. **TypeScript restart**: Restart your TS language server after major schema changes
6. **Version consistency**: Scripts ensure host and container always match

## What's New vs. Previous Version

✅ **Host + Container Generation**: Prisma client generated on both systems
✅ **Editor Integration**: Your text editor sees new types immediately  
✅ **Type Safety**: No more stale TypeScript errors
✅ **Automated Sync**: Scripts handle both locations automatically
✅ **Better Feedback**: Clear messaging about what's happening where

## Next Steps

- Set up automatic schema validation in CI/CD
- Add database seeding scripts
- Consider Prisma migrations for production
- Set up schema versioning strategy
