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
        Schema::table('profile_change_requests', function (Blueprint $table) {
            // Add experience columns as decimal to allow values like 1.5 years
            $table->decimal('experience', 5, 1)->nullable()->after('hourly_rate');
            $table->decimal('old_experience', 5, 1)->nullable()->after('old_hourly_rate');
        });

        // Update field_name enum to include 'experience'
        // For SQLite, we need to recreate the table with the new enum values
        if (DB::getDriverName() === 'sqlite') {
            // SQLite doesn't support ALTER TABLE for enum, so we'll use a workaround
            // We'll just add the columns and update the enum handling in the application
            DB::statement("PRAGMA foreign_keys=off");
            
            // Note: SQLite doesn't support enum, so field_name is stored as string
            // The enum constraint is handled at the application level
        } else {
            // For MySQL/PostgreSQL, we can modify the enum
            DB::statement("ALTER TABLE profile_change_requests MODIFY COLUMN field_name ENUM('name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'experience', 'multiple')");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('profile_change_requests', function (Blueprint $table) {
            $table->dropColumn(['experience', 'old_experience']);
        });

        // Revert field_name enum (only for non-SQLite databases)
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE profile_change_requests MODIFY COLUMN field_name ENUM('name', 'first_name', 'last_name', 'address', 'phone', 'hourly_rate', 'multiple')");
        }
    }
};
