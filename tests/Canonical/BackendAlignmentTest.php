<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Canonical;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Contracts\TemplateAuthorization;
use Nvl\Templates\Enums\TemplateAbility;
use Nvl\Templates\Models\Template;
use Nvl\Templates\Models\TemplateRevision;
use Nvl\Templates\Tests\CanonicalTestCase as TestCase;
use Nvl\Templates\Tests\Support\DocumentClient as Templates;
use Nvl\Templates\Tests\Support\Documents;

final class BackendAlignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_record_specific_management_policy_cannot_be_bypassed_by_saving(): void
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('private', 'Private');
        app()->instance(TemplateAuthorization::class, new class implements TemplateAuthorization
        {
            public function authorize(TemplateAbility $ability, Authenticatable|SystemActor $actor, array $context = []): void
            {
                $resource = $context['resource'] ?? null;
                if ($ability === TemplateAbility::Manage && $resource instanceof Template) {
                    throw new AuthorizationException;
                }
            }
        });
        $this->expectException(AuthorizationException::class);
        $api->saveDraft($t->id, Documents::standalone(), 0);
    }

    public function test_hidden_required_inputs_need_a_default_before_publication(): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['inputs']['properties']['secret'] = ['type' => 'string'];
        $doc['dataSchema']['properties']['inputs']['required'] = ['secret'];
        $this->expectException(ValidationException::class);
        $this->publish($doc);
    }

    public function test_binding_paths_must_be_declared_in_the_runtime_schema(): void
    {
        $doc = Documents::standalone();
        $doc['artifacts']['bindings'][1]['path'] = 'inputs.unknown';
        $this->expectException(ValidationException::class);
        $this->publish($doc);
    }

    public function test_static_managed_image_references_must_be_available_at_publication(): void
    {
        $doc = Documents::standalone();
        $doc['content']['logo'] = '00000000-0000-0000-0000-000000000000';
        $doc['dataSchema']['properties']['content']['properties']['logo'] = ['type' => 'string'];
        $doc['artifacts']['html'] = '<img src="{{logo}}">';
        $doc['artifacts']['bindings'][] = ['id' => 'logo', 'kind' => 'image', 'path' => 'content.logo'];
        $this->expectException(ValidationException::class);
        $this->publish($doc);
    }

    public function test_explicit_resource_dependency_closures_obey_the_parent_scope(): void
    {
        $api = app(Templates::class);
        $a = $api->createTemplate('a', 'A');
        $b = $api->createTemplate('b', 'B');
        $secret = $api->createResource('secret', 'Secret', 'content', 'template', $a->id);
        $api->publishResource($secret->id, ['value' => 'private'], 0);
        $partial = $api->createResource('partial', 'Shared partial', 'partial');
        $api->publishResource($partial->id, ['dependencies' => [['resourceId' => $secret->id, 'revision' => 1]]], 0);
        $doc = Documents::standalone();
        $doc['dependencies'] = [['resourceId' => $partial->id, 'revision' => 1]];
        $d = $api->saveDraft($b->id, $doc, 0);
        $this->expectException(ValidationException::class);
        $api->publish($b->id, $d->version);
    }

    public function test_group_variants_cannot_silently_change_the_family_output_target(): void
    {
        $api = app(Templates::class);
        $g = $api->createGroup('g', 'Group');
        $api->publishGroup($g->id, Documents::standalone(), 0);
        $t = $api->createTemplate('v', 'Variant', $g->id);
        $doc = Documents::variant($g->id, 1, 'Variant');
        $doc['target'] = 'document';
        $this->expectException(ValidationException::class);
        $api->saveDraft($t->id, $doc, 0);
    }

    public function test_fixed_styles_support_declared_keyword_weights_and_string_lengths(): void
    {
        $doc = Documents::standalone();
        $doc['dataSchema']['properties']['settings']['properties']['weight'] = ['type' => 'string', 'enum' => ['normal', 'bold']];
        $doc['dataSchema']['properties']['settings']['properties']['padding'] = ['type' => 'string', 'enum' => ['12px 24px']];
        $doc['settingsDefaults'] += ['weight' => 'bold', 'padding' => '12px 24px'];
        $doc['artifacts']['html'] = '<p style="font-weight:{{weight}};padding:{{padding}}">{{message}}</p>';
        $doc['artifacts']['bindings'][] = ['id' => 'weight', 'kind' => 'style', 'path' => 'settings.weight', 'property' => 'font-weight'];
        $doc['artifacts']['bindings'][] = ['id' => 'padding', 'kind' => 'style', 'path' => 'settings.padding', 'property' => 'padding'];
        $r = $this->publish($doc);
        $html = app(Templates::class)->render($r->id, facts: ['code' => 'ABC'])->html;
        self::assertStringContainsString('font-weight:bold', $html);
        self::assertStringContainsString('padding:12px 24px', $html);
    }

    private function publish(array $doc): TemplateRevision
    {
        $api = app(Templates::class);
        $t = $api->createTemplate('example', 'Example');
        $d = $api->saveDraft($t->id, $doc, 0);

        return $api->publish($t->id, $d->version);
    }
}
