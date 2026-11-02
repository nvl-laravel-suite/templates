<?php

declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
        $schema = Schema::connection($this->getConnection());
        $schema->table(Scope::table('drafts'), fn (Blueprint $t) => $t->json('proposed_basis')->nullable());
        $schema->table(Scope::table('resources'), fn (Blueprint $t) => $t->json('restrictions')->nullable());
        $schema->table(Scope::table('resource_revisions'), function (Blueprint $t): void {
            $t->json('provenance')->nullable();
            $t->uuid('origin_revision_id')->nullable();
            $t->foreign(['scope_id', 'origin_revision_id'], 'tpl_resource_copy_origin')->references(['scope_id', 'id'])->on(Scope::table('resource_revisions'))->restrictOnDelete();
        });
        $schema->create(Scope::table('family_changes'), function (Blueprint $t): void {
            $t->uuid('id')->primary();
            $t->string('scope_id', 128);
            $t->string('owner_scope_key', 191)->nullable();
            $t->text('owner_reference')->nullable();
            $t->uuid('template_id');
            $t->string('operation');
            $t->unsignedInteger('expected_version');
            $t->string('source_checksum', 64);
            $t->json('inputs');
            $t->json('result');
            $t->string('status')->default('pending');
            $t->json('resolutions')->nullable();
            $t->unsignedInteger('applied_version')->nullable();
            $t->timestamps();
            $t->foreign('template_id', 'nvl_tpl_family_changes_parent')->references('id')->on(Scope::table('templates'))->restrictOnDelete();
            $t->foreign(['scope_id', 'template_id'])->references(['scope_id', 'id'])->on(Scope::table('templates'))->restrictOnDelete();
            $t->index(['scope_id', 'template_id', 'status']);
        });
    }

    public function down(): void
    {
        $s = Schema::connection($this->getConnection());
        $s->dropIfExists(Scope::table('family_changes'));
        $sqlite = $s->getConnection()->getDriverName() === 'sqlite';
        $s->table(Scope::table('resource_revisions'), function (Blueprint $t) use ($sqlite): void {
            $t->dropForeign($sqlite ? ['scope_id', 'origin_revision_id'] : 'tpl_resource_copy_origin');
            $t->dropColumn('origin_revision_id');
        });
        foreach (['drafts' => 'proposed_basis', 'resources' => 'restrictions', 'resource_revisions' => 'provenance'] as $table => $column) {
            $s->table(Scope::table($table), fn (Blueprint $t) => $t->dropColumn($column));
        }
    }
};
