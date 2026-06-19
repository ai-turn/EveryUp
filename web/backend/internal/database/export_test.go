// export_test.go exposes unexported functions for white-box testing.
// This file is compiled only during tests (package database, not database_test).
package database

// MigrateV20ForTest re-runs migrateV20 on the already-open DB.
// Used to verify the migration is idempotent (safe to run twice).
var MigrateV20ForTest = migrateV20
