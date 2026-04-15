# Deployment Migration Guide

## Overview

This guide explains how database migrations are automatically executed during deployment to ensure schema changes are applied before the application restarts.

For RBAC rollout-specific controls (targeted seeders, contract smoke tests, and rollback sequence), see:

- `docs/RBAC_ROLLOUT_RUNBOOK.md`
- `docs/RBAC_ADMIN_BOOTSTRAP.md`

## Migration Strategy

### Automatic Migration on Deployment

The CD deployment workflow (`.github/workflows/cd-deploy.yml`) automatically runs database migrations before restarting the backend service:

```bash
# 1. Pull latest Docker image
docker compose pull backend

# 2. Run migrations (CRITICAL: Before restart)
docker compose run --rm backend npx sequelize-cli db:migrate

# 3. Restart backend with new schema
docker compose up -d backend

# 4. Verify migration status
docker compose exec -T backend npx sequelize-cli db:migrate:status
```

### Order of Operations

1. **Pull** - Get latest code/image
2. **Migrate** - Apply database schema changes
3. **Deploy** - Restart application with new schema
4. **Verify** - Check migration status and health

## Migration Commands

### Local Development

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback last migration
npm run db:migrate:undo

# Rollback all migrations (DANGER!)
npm run db:migrate:undo:all

# Run seeders (dev/staging only)
npm run db:seed

# Undo all seeders
npm run db:seed:undo
```

### Production (via Docker)

```bash
# Run migrations in Docker container
docker compose run --rm backend npx sequelize-cli db:migrate

# Check migration status
docker compose exec backend npx sequelize-cli db:migrate:status

# Rollback last migration (emergency)
docker compose run --rm backend npx sequelize-cli db:migrate:undo
```

## Seeder Compatibility

### Current Seeder Status

✅ **All seeders are compatible with the new schema**

The seeders use dynamic queries to fetch foreign key references instead of hardcoding IDs:

```javascript
// ✅ GOOD: Dynamic ID fetching
const operators = await queryInterface.sequelize.query(
  `SELECT user_id FROM rt_users ORDER BY user_id LIMIT 3`,
  { type: Sequelize.QueryTypes.SELECT },
);

const operator1 = operators[0].user_id; // Will be INTEGER

// ❌ BAD: Hardcoded IDs
const operator1 = "OP123"; // Would fail with foreign key constraints
```

### Seeder Files Verified

- ✅ `20260106000003-seed-operator-activities.js` - Uses dynamic queries, proper types
- ✅ `20260106000004-seed-booking-tables.js` - References `operator_activities.id` correctly

### Running Seeders

```bash
# Development/Staging only
npm run db:seed

# Production: Do NOT run seeders automatically
# Seeders should only be run manually in production with approval
```

## Migration Best Practices

### Creating Migrations

1. **Always create migrations for schema changes**

   ```bash
   npx sequelize-cli migration:generate --name add-new-column-to-table
   ```

2. **Write reversible migrations**

   ```javascript
   async up(queryInterface, Sequelize) {
     await queryInterface.addColumn('table_name', 'new_column', {
       type: Sequelize.STRING
     });
   },

   async down(queryInterface, Sequelize) {
     await queryInterface.removeColumn('table_name', 'new_column');
   }
   ```

3. **Test migrations locally first**
   ```bash
   npm run db:migrate:undo  # Rollback
   npm run db:migrate       # Test up
   npm run db:migrate:undo  # Test down
   npm run db:migrate       # Final up
   npm test                 # Verify tests pass
   ```

### Foreign Key Constraints

**CRITICAL:** Foreign key types MUST match exactly:

```javascript
// Parent table
operator_activities: {
  id: {
    type: Sequelize.INTEGER,  // ← Must be INTEGER
    autoIncrement: true,
    primaryKey: true
  }
}

// Child table
activity_booking: {
  operator_activity_id: {
    type: Sequelize.INTEGER,  // ← MUST match parent exactly
    references: {
      model: 'operator_activities',
      key: 'id'
    }
  }
}
```

### Data Type Consistency

Ensure consistency across:

1. **Migration files** - Schema definition
2. **Model files** - Application ORM layer
3. **Seeder files** - Test/dev data
4. **Test fixtures** - Test data

## Rollback Strategy

### Automatic Rollback (Not Implemented)

Currently, failed deployments do NOT automatically rollback migrations. This is intentional to prevent data loss.

### Manual Rollback Process

If a deployment fails due to migration issues:

```bash
# 1. SSH into production server
ssh user@production-server

# 2. Navigate to project directory
cd ~/st_rural_tourism

# 3. Check current migration status
docker compose exec backend npx sequelize-cli db:migrate:status

# 4. Rollback problematic migration
docker compose run --rm backend npx sequelize-cli db:migrate:undo

# 5. Restart application
docker compose restart backend

# 6. Verify health
docker compose ps
curl http://localhost:3000/health
```

### Emergency Procedures

1. **Database backup** - Always maintain recent backups
2. **Migration testing** - Test migrations in staging environment first
3. **Gradual rollout** - Deploy to staging → production sequentially
4. **Monitor logs** - Check migration output during deployment

## Sequelize CLI Configuration

The project uses `.sequelizerc` to configure Sequelize CLI paths:

```javascript
const path = require("path");

module.exports = {
  config: path.resolve("config", "config.js"),
  "models-path": path.resolve("models"),
  "seeders-path": path.resolve("seeders"),
  "migrations-path": path.resolve("migrations"),
};
```

Database configuration is in `config/config.js` with environment-specific settings.

## Monitoring Migration Status

### Check Pending Migrations

```bash
# Local
npm run db:migrate:status

# Production
docker compose exec backend npx sequelize-cli db:migrate:status
```

### Migration Log Table

Sequelize tracks migrations in the `SequelizeMeta` table:

```sql
SELECT * FROM SequelizeMeta ORDER BY name;
```

Each row represents an executed migration file.

## Troubleshooting

### Migration Fails During Deployment

```bash
# Check logs
docker compose logs backend

# Check migration status
docker compose exec backend npx sequelize-cli db:migrate:status

# Try running migration manually
docker compose run --rm backend npx sequelize-cli db:migrate
```

### Foreign Key Constraint Errors

```bash
# Verify table structure
docker compose exec db mysql -u root -p -e "DESCRIBE operator_activities;"

# Check foreign key relationships
docker compose exec db mysql -u root -p -e "
  SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'rural_tourism'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
"
```

### Migration Stuck

```bash
# Check for locked tables
docker compose exec db mysql -u root -p -e "SHOW FULL PROCESSLIST;"

# Force unlock (DANGER!)
docker compose exec db mysql -u root -p -e "UNLOCK TABLES;"
```

## Related Documentation

- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - Schema changes and model refactoring
- [SOLID_ARCHITECTURE.md](./SOLID_ARCHITECTURE.md) - Architecture principles
- [TECHNICAL_INTEGRATION_DOC.md](./TECHNICAL_INTEGRATION_DOC.md) - System integration details

## Summary

### What Changed

1. ✅ Added migration commands to `package.json` for convenience
2. ✅ Updated `.github/workflows/cd-deploy.yml` to run migrations automatically
3. ✅ Verified seeders are compatible with new schema (no changes needed)

### Key Takeaways

- **Migrations run automatically** on every production deployment
- **Seeders are compatible** with the refactored schema
- **Migration status** is checked after each deployment
- **Manual rollback** available if needed (not automatic)
- **Test migrations locally** before committing to production

### Commands Quick Reference

```bash
# Development
npm run db:migrate         # Run migrations
npm run db:migrate:status  # Check status
npm run db:seed            # Run seeders (dev only)

# Production (Docker)
docker compose run --rm backend npx sequelize-cli db:migrate
docker compose exec backend npx sequelize-cli db:migrate:status
```
