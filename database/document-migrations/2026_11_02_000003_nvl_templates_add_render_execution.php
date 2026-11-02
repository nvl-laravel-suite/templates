<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Nvl\Support\Config\PackageStorage;
use Nvl\Templates\Support\Scope;

return new class extends Migration
{
    public function getConnection(): ?string
    {
        return PackageStorage::connection('templates');
    }

    public function up(): void
    {
        Schema::connection($this->getConnection())->table(Scope::table('renders'), function (Blueprint $table): void {
            $table->longText('snapshot')->nullable()->change();
            $table->string('output')->default('html');
            $table->string('snapshot_checksum', 64)->nullable();
            $table->unsignedInteger('generation')->default(0);
            $table->unsignedInteger('attempts')->default(0);
            $table->uuid('processing_token')->nullable();
            $table->timestamp('available_at')->nullable();
            $table->timestamp('dispatch_requested_at')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('lease_expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('purged_at')->nullable();
            $table->index(['scope_id', 'status', 'available_at'], 'tpl_render_recovery');
        });
    }

    public function down(): void
    {
        DB::connection($this->getConnection())->table(Scope::table('renders'))
            ->whereNull('snapshot')->update(['snapshot' => Crypt::encryptString('[]')]);
        Schema::connection($this->getConnection())->table(Scope::table('renders'), function (Blueprint $table): void {
            // Preserve capacity on rollback; retained encrypted snapshots may exceed TEXT.
            $table->longText('snapshot')->nullable(false)->change();
            $table->dropIndex('tpl_render_recovery');
            $table->dropColumn(['output', 'snapshot_checksum', 'generation', 'attempts', 'processing_token', 'available_at', 'dispatch_requested_at', 'dispatched_at', 'lease_expires_at', 'completed_at', 'failed_at', 'expires_at', 'purged_at']);
        });
    }
};
