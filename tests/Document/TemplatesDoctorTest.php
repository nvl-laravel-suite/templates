<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Nvl\Support\Doctor\DoctorContributor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Services\ConfiguredTemplateAuthorization;
use Nvl\Templates\Services\TemplatesDoctor;
use Nvl\Templates\Tests\CanonicalTestCase;

final class TemplatesDoctorTest extends CanonicalTestCase
{
    public function test_missing_schema_fails_readiness_without_creating_domain_storage(): void
    {
        $report = app(TemplatesDoctor::class)->inspect();
        self::assertFalse($report['healthy']);
        self::assertFalse(Schema::hasTable('nvl_templates_templates'));
    }

    public function test_fresh_document_schema_is_checked_without_writes(): void
    {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        DB::enableQueryLog();
        $report = app(TemplatesDoctor::class)->inspect();
        self::assertTrue($report['healthy'], json_encode($report, JSON_THROW_ON_ERROR));
        foreach (DB::getQueryLog() as $query) {
            self::assertDoesNotMatchRegularExpression('/^\s*(insert|update|delete|create|alter|drop|truncate)\b/i', $query['query']);
        }
        $this->artisan('nvl:templates:doctor', ['--strict' => true, '--format' => 'json'])->assertSuccessful();
        $contributors = iterator_to_array($this->app->tagged(DoctorContributor::class));
        $templates = array_values(array_filter($contributors, static fn (DoctorContributor $contributor): bool => $contributor->package() === 'nvl/templates'));
        self::assertCount(1, $templates);
        foreach ($templates[0]->inspect() as $check) {
            self::assertTrue($check->passed);
        }
    }

    public function test_default_deny_and_invalid_limits_are_reported_as_unready(): void
    {
        $this->app->instance(TemplateAuthorization::class, new ConfiguredTemplateAuthorization);
        config(['nvl-templates.limits.document_bytes' => 0]);
        $report = app(TemplatesDoctor::class)->inspect('core');
        self::assertFalse($report['healthy']);
        self::assertFalse($report['checks']['authorization.configured']);
        self::assertFalse($report['checks']['limits']);
    }
}
