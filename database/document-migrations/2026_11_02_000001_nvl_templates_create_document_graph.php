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
        foreach (array_keys(config('nvl-templates.tables')) as $key) {
            if ($schema->hasTable(Scope::table($key))) {
                throw new LogicException('A populated or legacy Templates table already exists. Stage and adopt the source graph before enabling document migrations.');
            }
        }
        $base = function (Blueprint $t): void {
            $t->uuid('id')->primary();
            $t->string('scope_id', 128);
            $t->timestamps();
            $t->unique(['scope_id', 'id']);
        };
        foreach (['groups', 'templates', 'resources'] as $key) {
            $schema->create(Scope::table($key), function (Blueprint $t) use ($base, $key): void {
                $base($t);
                $t->string('key');
                $t->string('name');
                $t->string('status')->default('active');
                $t->unsignedInteger('version')->default(0);
                $t->uuid('current_revision_id')->nullable();
                if ($key === 'templates') {
                    $t->uuid('group_id')->nullable();
                    $t->foreign(['scope_id', 'group_id'])->references(['scope_id', 'id'])->on(Scope::table('groups'))->restrictOnDelete();
                }
                if ($key === 'resources') {
                    $t->string('kind', 32);
                    $t->string('scope', 32);
                    $t->string('owner_key', 64);
                    $t->uuid('group_id')->nullable();
                    $t->uuid('template_id')->nullable();
                    $t->unique(['scope_id', 'kind', 'owner_key', 'key'], 'tpl_resource_key');
                    $t->foreign(['scope_id', 'group_id'])->references(['scope_id', 'id'])->on(Scope::table('groups'))->restrictOnDelete();
                    $t->foreign(['scope_id', 'template_id'])->references(['scope_id', 'id'])->on(Scope::table('templates'))->restrictOnDelete();
                } else {
                    $t->unique(['scope_id', 'key']);
                }
            });
        }
        $schema->create(Scope::table('group_revisions'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->uuid('group_id');
            $t->unsignedInteger('revision');
            $t->json('source');
            $t->json('document');
            $t->string('checksum', 64);
            $t->timestamp('published_at');
            $t->unique(['scope_id', 'group_id', 'revision']);
            $t->unique(['scope_id', 'group_id', 'id']);
            $t->foreign('group_id', 'nvl_tpl_group_revisions_parent')->references('id')->on(Scope::table('groups'))->restrictOnDelete();
            $t->foreign(['scope_id', 'group_id'])->references(['scope_id', 'id'])->on(Scope::table('groups'))->restrictOnDelete();
        });
        $schema->create(Scope::table('drafts'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->uuid('template_id');
            $t->unsignedInteger('version');
            $t->json('document');
            $t->unique(['scope_id', 'template_id']);
            $t->foreign('template_id', 'nvl_tpl_drafts_parent')->references('id')->on(Scope::table('templates'))->restrictOnDelete();
            $t->foreign(['scope_id', 'template_id'])->references(['scope_id', 'id'])->on(Scope::table('templates'))->restrictOnDelete();
        });
        $schema->create(Scope::table('revisions'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->uuid('template_id');
            $t->unsignedInteger('revision');
            $t->uuid('group_id')->nullable();
            $t->uuid('group_revision_id')->nullable();
            $t->json('source');
            $t->json('document');
            $t->json('dependencies');
            $t->string('checksum', 64);
            $t->timestamp('published_at');
            $t->unique(['scope_id', 'template_id', 'revision']);
            $t->unique(['scope_id', 'template_id', 'id']);
            $t->foreign('template_id', 'nvl_tpl_revisions_parent')->references('id')->on(Scope::table('templates'))->restrictOnDelete();
            $t->foreign(['scope_id', 'template_id'])->references(['scope_id', 'id'])->on(Scope::table('templates'))->restrictOnDelete();
            $t->foreign(['scope_id', 'group_id', 'group_revision_id'], 'nvl_tpl_revision_group_pin')->references(['scope_id', 'group_id', 'id'])->on(Scope::table('group_revisions'))->restrictOnDelete();
        });
        $schema->create(Scope::table('resource_revisions'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->uuid('resource_id');
            $t->unsignedInteger('revision');
            $t->json('document');
            $t->string('checksum', 64);
            $t->unique(['scope_id', 'resource_id', 'revision'], 'nvl_tpl_resource_revision_unique');
            $t->foreign('resource_id', 'nvl_tpl_resource_revisions_parent')->references('id')->on(Scope::table('resources'))->restrictOnDelete();
            $t->foreign(['scope_id', 'resource_id'])->references(['scope_id', 'id'])->on(Scope::table('resources'))->restrictOnDelete();
        });
        $schema->create(Scope::table('assets'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->string('name');
            $t->uuid('media_id')->nullable();
            $t->unsignedBigInteger('media_revision')->nullable();
            $t->string('mime_type');
            $t->unsignedBigInteger('size');
            $t->string('checksum', 64);
            $t->timestamp('archived_at')->nullable();
        });
        $schema->create(Scope::table('renders'), function (Blueprint $t) use ($base): void {
            $base($t);
            $t->uuid('template_revision_id');
            $t->string('idempotency_key')->nullable();
            $t->string('fingerprint', 64);
            $t->string('status');
            $t->text('snapshot');
            $t->json('result')->nullable();
            $t->text('error')->nullable();
            $t->unique(['scope_id', 'idempotency_key']);
            $t->foreign('template_revision_id', 'nvl_tpl_renders_parent')->references('id')->on(Scope::table('revisions'))->restrictOnDelete();
            $t->foreign(['scope_id', 'template_revision_id'])->references(['scope_id', 'id'])->on(Scope::table('revisions'))->restrictOnDelete();
        });
        foreach (['groups' => ['group_revisions', 'group_id'], 'templates' => ['revisions', 'template_id']] as $root => [$versions, $owner]) {
            $schema->table(Scope::table($root), function (Blueprint $t) use ($root, $versions, $owner): void {
                $t->foreign(['scope_id', 'id', 'current_revision_id'], 'tpl_'.$root.'_current')->references(['scope_id', $owner, 'id'])->on(Scope::table($versions));
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->getConnection());
        $dropTables = static function () use ($schema): void {
            foreach (['renders', 'assets', 'resource_revisions', 'drafts', 'revisions', 'group_revisions', 'resources', 'templates', 'groups'] as $key) {
                $schema->dropIfExists(Scope::table($key));
            }
        };
        if ($schema->getConnection()->getDriverName() === 'sqlite') {
            $schema->withoutForeignKeyConstraints($dropTables);

            return;
        }
        foreach (['templates', 'groups'] as $root) {
            if ($schema->hasTable(Scope::table($root))) {
                $schema->table(Scope::table($root), static function (Blueprint $table) use ($root): void {
                    $table->dropForeign('tpl_'.$root.'_current');
                });
            }
        }
        $dropTables();
    }
};
