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
            // Add experience columns if they don't exist
            if (!Schema::hasColumn('profile_change_requests', 'experience')) {
                $table->decimal('experience', 5, 1)->nullable()->after('hourly_rate');
            }
            if (!Schema::hasColumn('profile_change_requests', 'old_experience')) {
                $table->decimal('old_experience', 5, 1)->nullable()->after('old_hourly_rate');
            }
            
            // Add max_pets columns
            if (!Schema::hasColumn('profile_change_requests', 'max_pets')) {
                $table->integer('max_pets')->nullable()->after('experience');
            }
            if (!Schema::hasColumn('profile_change_requests', 'old_max_pets')) {
                $table->integer('old_max_pets')->nullable()->after('old_experience');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('profile_change_requests', function (Blueprint $table) {
            if (Schema::hasColumn('profile_change_requests', 'max_pets')) {
                $table->dropColumn('max_pets');
            }
            if (Schema::hasColumn('profile_change_requests', 'old_max_pets')) {
                $table->dropColumn('old_max_pets');
            }
            // Note: We don't drop experience columns as they might be needed
        });
    }
};
