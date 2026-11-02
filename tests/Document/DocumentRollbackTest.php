<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Nvl\Templates\Tests\CanonicalTestCase;
use Nvl\Templates\Tests\Support\DocumentClient;
use Nvl\Templates\Tests\Support\Documents;

final class DocumentRollbackTest extends CanonicalTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $database = getenv('NVL_TEMPLATES_PG_TEST_DATABASE');
        if ($database === false || $database === '') {
            return;
        }
        if (! is_string($database) || ! preg_match('/\Anvl_own_test_templates_[a-z0-9]+\z/D', $database)) {
            throw new \RuntimeException('A dedicated temporary Templates test database is required.');
        }
        $app['config']->set([
            'database.default' => 'pgsql',
            'database.connections.pgsql' => ['driver' => 'pgsql', 'host' => '/tmp', 'port' => 5432, 'database' => $database, 'username' => get_current_user(), 'password' => '', 'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer'],
            'nvl-core.connection' => 'pgsql',
        ]);
    }

    public function test_native_publication_and_full_document_rollback_with_live_revision_pointers(): void
    {
        $paths = glob(__DIR__.'/../../database/document-migrations/*.php');
        foreach ($paths as $path) {
            (require $path)->up();
        }
        self::assertSame(getenv('NVL_TEMPLATES_PG_TEST_DATABASE') ? 'pgsql' : 'sqlite', DB::connection()->getDriverName());
        $api = app(DocumentClient::class);
        $family = $api->createGroup('pg-family', 'PostgreSQL family');
        $base = $api->publishGroup($family->id, Documents::standalone('Family'), 0);
        $template = $api->createTemplate('pg-template', 'PostgreSQL template');
        $draft = $api->saveDraft($template->id, Documents::standalone('Template'), 0);
        $revision = $api->publish($template->id, $draft->version);
        self::assertNotNull($base->id);
        self::assertNotNull($revision->id);
        foreach (array_reverse($paths) as $path) {
            (require $path)->down();
        }
        foreach (config('nvl-templates.tables') as $table) {
            self::assertFalse(Schema::hasTable($table));
        }
    }
}
