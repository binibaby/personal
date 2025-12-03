<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // For SQLite, we need to recreate the table with the new CHECK constraint
        if (DB::getDriverName() === 'sqlite') {
            // Drop temp table if it exists from previous failed migration
            DB::statement("DROP TABLE IF EXISTS profile_change_requests_new");
            
            // SQLite doesn't support ALTER COLUMN, so we recreate the table with new constraint
            DB::statement("CREATE TABLE profile_change_requests_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                field_name TEXT CHECK(field_name IN ('name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'experience', 'multiple')) DEFAULT 'multiple',
                first_name TEXT,
                last_name TEXT,
                phone TEXT,
                hourly_rate DECIMAL(8,2),
                experience DECIMAL(5,1),
                old_first_name TEXT,
                old_last_name TEXT,
                old_phone TEXT,
                old_hourly_rate DECIMAL(8,2),
                old_experience DECIMAL(5,1),
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                admin_notes TEXT,
                reviewed_by INTEGER,
                reviewed_at DATETIME,
                last_approved_at DATETIME,
                cooldown_days INTEGER DEFAULT 14,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )");
            
            // Copy all data from old table to new table, ensuring field_name is valid
            // If field_name is not in the allowed list, set it to 'multiple'
            DB::statement("INSERT INTO profile_change_requests_new 
                SELECT 
                    id, user_id,
                    CASE 
                        WHEN field_name IN ('name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'experience', 'multiple') 
                        THEN field_name 
                        ELSE 'multiple' 
                    END as field_name,
                    first_name, last_name, phone, hourly_rate, experience,
                    old_first_name, old_last_name, old_phone, old_hourly_rate, old_experience,
                    old_value, new_value, reason, status, admin_notes, reviewed_by, reviewed_at,
                    last_approved_at, cooldown_days, created_at, updated_at
                FROM profile_change_requests");
            
            // Drop old table and rename new one
            DB::statement("DROP TABLE profile_change_requests");
            DB::statement("ALTER TABLE profile_change_requests_new RENAME TO profile_change_requests");
            
            // Recreate indexes
            DB::statement("CREATE INDEX profile_change_requests_user_id_status_index ON profile_change_requests(user_id, status)");
            DB::statement("CREATE INDEX profile_change_requests_status_index ON profile_change_requests(status)");
            DB::statement("CREATE INDEX profile_change_requests_created_at_index ON profile_change_requests(created_at)");
        } else {
            // For MySQL/PostgreSQL, we can modify the enum directly
            Schema::table('profile_change_requests', function (Blueprint $table) {
                $table->dropColumn('field_name');
            });
            
            Schema::table('profile_change_requests', function (Blueprint $table) {
                $table->enum('field_name', ['name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'experience', 'multiple'])->default('multiple')->after('user_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // Revert to previous enum values (without experience)
            DB::statement("CREATE TABLE profile_change_requests_old AS SELECT * FROM profile_change_requests");
            
            DB::statement("DROP TABLE profile_change_requests");
            DB::statement("CREATE TABLE profile_change_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                field_name TEXT CHECK(field_name IN ('name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'multiple')) DEFAULT 'multiple',
                first_name TEXT,
                last_name TEXT,
                phone TEXT,
                hourly_rate DECIMAL(8,2),
                experience DECIMAL(5,1),
                old_first_name TEXT,
                old_last_name TEXT,
                old_phone TEXT,
                old_hourly_rate DECIMAL(8,2),
                old_experience DECIMAL(5,1),
                old_value TEXT,
                new_value TEXT,
                reason TEXT,
                status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                admin_notes TEXT,
                reviewed_by INTEGER,
                reviewed_at DATETIME,
                last_approved_at DATETIME,
                cooldown_days INTEGER DEFAULT 14,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )");
            
            // Copy data back, excluding rows with experience field_name
            DB::statement("INSERT INTO profile_change_requests SELECT * FROM profile_change_requests_old WHERE field_name != 'experience'");
            DB::statement("DROP TABLE profile_change_requests_old");
            
            // Recreate indexes
            DB::statement("CREATE INDEX profile_change_requests_user_id_status_index ON profile_change_requests(user_id, status)");
            DB::statement("CREATE INDEX profile_change_requests_status_index ON profile_change_requests(status)");
            DB::statement("CREATE INDEX profile_change_requests_created_at_index ON profile_change_requests(created_at)");
        } else {
            Schema::table('profile_change_requests', function (Blueprint $table) {
                $table->dropColumn('field_name');
            });
            
            Schema::table('profile_change_requests', function (Blueprint $table) {
                $table->enum('field_name', ['name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'multiple'])->default('multiple')->after('user_id');
            });
        }
    }
};
