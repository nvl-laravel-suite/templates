<?php

declare(strict_types=1);

namespace Nvl\Templates\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use JsonException;
use Nvl\Support\Auth\CanonicalActorResolver;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Enums\TemplateStatus;
use Nvl\Templates\Support\TemplatesConfiguration;
use Nvl\Translatable\Rules\SupportedLocaleMapRule;

/**
 * Applies deterministic byte, depth, and item limits to template-owned values.
 *
 * @internal
 */
final class TemplateContentGuard
{
    public function __construct(private readonly CanonicalActorResolver $actors) {}

    /** Supply current canonical actor attributes before the host template policy. */
    public function actor(Authenticatable|SystemActor $actor): Authenticatable|SystemActor
    {
        if ($actor instanceof SystemActor) {
            return $actor;
        }
        if (! $actor instanceof Model) {
            throw new AuthorizationException('Templates requires a persisted actor.');
        }

        return $this->actors->resolve($actor);
    }

    /** Resolve the persisted actor identity without coercing objects or arrays. */
    public static function actorId(Authenticatable|SystemActor $actor): ?string
    {
        if ($actor instanceof SystemActor) {
            return null;
        }
        $id = $actor->getAuthIdentifier();
        if (! is_int($id) && ! is_string($id)) {
            throw new AuthorizationException('Templates requires a scalar actor identity.');
        }

        return (string) $id;
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function schema(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'schema');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function data(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'data');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function payload(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'payload');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function settings(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'settings');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function metadata(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'metadata');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    public function rendererOptions(array $value): array
    {
        return $this->assertObjectWithinLimits($value, 'renderer_options');
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<string, mixed>
     */
    private function assertObjectWithinLimits(array $value, string $kind): array
    {
        $object = [];

        foreach ($value as $key => $item) {
            if (! is_string($key)) {
                throw new InvalidArgumentException(
                    "Template {$kind} must be a JSON object.",
                );
            }

            $object[$key] = $item;
        }

        $this->assertJsonValue($object, $kind);

        try {
            $encoded = json_encode($object, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new InvalidArgumentException("Template {$kind} must be valid JSON data.", 0, $exception);
        }

        $maximumBytes = TemplatesConfiguration::limit("{$kind}_bytes", 262_144);

        if (strlen($encoded) > $maximumBytes) {
            throw new InvalidArgumentException("Template {$kind} exceeds {$maximumBytes} bytes.");
        }

        $items = 0;
        $this->walk(
            $object,
            1,
            TemplatesConfiguration::limit("{$kind}_depth", 16),
            TemplatesConfiguration::limit("{$kind}_items", 2_000),
            $items,
            $kind,
        );

        return $object;
    }

    private function assertJsonValue(mixed $value, string $kind): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                $this->assertJsonValue($item, $kind);
            }

            return;
        }

        if (is_float($value) && ! is_finite($value)) {
            throw new InvalidArgumentException(
                "Template {$kind} must not contain non-finite numbers.",
            );
        }

        if ($value !== null
            && ! is_string($value)
            && ! is_int($value)
            && ! is_float($value)
            && ! is_bool($value)) {
            throw new InvalidArgumentException(
                "Template {$kind} must contain only JSON scalar, list, and object values.",
            );
        }
    }

    /**
     * @param  array<array-key, mixed>  $value
     */
    private function walk(
        array $value,
        int $depth,
        int $maximumDepth,
        int $maximumItems,
        int &$items,
        string $kind,
    ): void {
        if ($depth > $maximumDepth) {
            throw new InvalidArgumentException("Template {$kind} exceeds depth {$maximumDepth}.");
        }

        foreach ($value as $item) {
            $items++;

            if ($items > $maximumItems) {
                throw new InvalidArgumentException("Template {$kind} exceeds {$maximumItems} items.");
            }

            if (is_array($item)) {
                $this->walk(
                    $item,
                    $depth + 1,
                    $maximumDepth,
                    $maximumItems,
                    $items,
                    $kind,
                );
            }
        }
    }

    /** Read the existing placement-key/field fallback projection from native Content arrays.
     * @param  array<string,mixed>  $composition
     */
    public function compositionValue(array $composition, string $path): mixed
    {
        $flattened = [];
        $append = function (array $block) use (&$append, &$flattened): void {
            $flattened[] = $block;
            /** @var list<array<string,mixed>> $children */
            $children = $block['children'];
            foreach ($children as $child) {
                $append($child);
            }
        };
        /** @var list<array<string,mixed>> $blocks */
        $blocks = $composition['blocks'] ?? [];
        foreach ($blocks as $block) {
            $append($block);
        }
        [$blockKey, $fieldPath] = array_pad(explode('.', $path, 2), 2, null);
        if ($fieldPath !== null) {
            foreach ($flattened as $block) {
                if ($block['key'] === $blockKey) {
                    return data_get($block['values'], $fieldPath);
                }
            }
        }
        foreach ($flattened as $block) {
            $value = data_get($block['values'], $path);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{key: string, status: TemplateStatus, metadata: array<string, mixed>, translations: array<string, array<string, mixed>>}
     */
    public function createTemplate(array $data): array
    {
        $this->assertInputKeys($data, ['key', 'status', 'metadata', 'translations']);
        $data += ['status' => TemplateStatus::Active, 'metadata' => [], 'translations' => []];
        $rules = [
            'key' => ['required', 'string', 'max:191', 'regex:/^[a-z0-9][a-z0-9._-]*$/'],
            'status' => ['required', Rule::enum(TemplateStatus::class)],
            'metadata' => ['array'],
            'translations' => ['array', new SupportedLocaleMapRule],
            'translations.*' => ['array:title,description'],
            'translations.*.title' => ['required', 'string', 'max:255'],
            'translations.*.description' => ['nullable', 'string'],
        ];

        Validator::make($data, $rules)->validate();

        if (is_string($data['status'])) {
            $data['status'] = TemplateStatus::from($data['status']);
        }

        /** @var array{key: string, status: TemplateStatus, metadata: array<string, mixed>, translations: array<string, array<string, mixed>>} $data */
        return $data;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{status: TemplateStatus, expected_revision: int, metadata?: array<string, mixed>, translations?: array<string, array<string, mixed>>}
     */
    public function updateTemplate(array $data): array
    {
        $this->assertInputKeys($data, ['status', 'expected_revision', 'metadata', 'translations']);
        $rules = [
            'status' => ['required', Rule::enum(TemplateStatus::class)],
            'expected_revision' => ['required', 'integer', 'min:1'],
            'metadata' => ['array'],
            'translations' => ['array', new SupportedLocaleMapRule],
            'translations.*' => ['array:title,description'],
            'translations.*.title' => ['required', 'string', 'max:255'],
            'translations.*.description' => ['nullable', 'string'],
        ];

        Validator::make($data, $rules)->validate();

        if (is_string($data['status'])) {
            $data['status'] = TemplateStatus::from($data['status']);
        }
        $data['expected_revision'] = is_int($data['expected_revision']) ? $data['expected_revision'] : (int) (is_string($data['expected_revision']) ? $data['expected_revision'] : 0);

        /** @var array{status: TemplateStatus, expected_revision: int, metadata?: array<string, mixed>, translations?: array<string, array<string, mixed>>} $data */
        return $data;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{metadata: array<string, mixed>}
     */
    public function createVersion(array $data): array
    {
        $this->assertInputKeys($data, ['metadata']);
        $data += ['metadata' => []];
        $rules = [
            'metadata' => ['array'],
        ];

        Validator::make($data, $rules)->validate();

        /** @var array{metadata: array<string, mixed>} $data */
        return $data;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{expected_revision: int, metadata?: array<string, mixed>}
     */
    public function updateVersion(array $data): array
    {
        $this->assertInputKeys($data, ['expected_revision', 'metadata']);
        $rules = [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'metadata' => ['array'],
        ];

        Validator::make($data, $rules)->validate();

        $data['expected_revision'] = is_int($data['expected_revision']) ? $data['expected_revision'] : (int) (is_string($data['expected_revision']) ? $data['expected_revision'] : 0);

        /** @var array{expected_revision: int, metadata?: array<string, mixed>} $data */
        return $data;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{ownerType: string, ownerId: string, profile: string, versionId: string|null, settings: array<string, mixed>, expected_revision: int}
     */
    public function assign(array $data): array
    {
        $this->assertInputKeys($data, ['ownerType', 'ownerId', 'profile', 'versionId', 'settings', 'expected_revision']);
        $data += ['profile' => 'default', 'versionId' => null, 'settings' => [], 'expected_revision' => 0];
        $rules = [
            'ownerType' => ['required', 'string', 'max:100'],
            'ownerId' => ['required', 'string', 'max:255'],
            'profile' => ['required', 'string', 'max:100'],
            'versionId' => ['nullable', 'uuid'],
            'settings' => ['array'],
            'expected_revision' => ['required', 'integer', 'min:0'],
        ];

        Validator::make($data, $rules)->validate();

        $data['expected_revision'] = is_int($data['expected_revision']) ? $data['expected_revision'] : (int) (is_string($data['expected_revision']) ? $data['expected_revision'] : 0);

        /** @var array{ownerType: string, ownerId: string, profile: string, versionId: string|null, settings: array<string, mixed>, expected_revision: int} $data */
        return $data;
    }

    /** Native Templates operation.
     * @param  array<string,mixed>  $data
     * @return array{locale: string, payload: array<string, mixed>, ownerType: string|null, ownerId: string|null, profile: string, versionId: string|null, idempotency_key: string|null, download: bool}
     */
    public function render(array $data): array
    {
        $this->assertInputKeys($data, ['locale', 'payload', 'ownerType', 'ownerId', 'profile', 'versionId', 'idempotency_key', 'download']);
        $data += ['ownerType' => null, 'ownerId' => null, 'profile' => 'default', 'versionId' => null, 'idempotency_key' => null, 'download' => false];
        $rules = [
            'locale' => ['required', 'string', 'max:35'],
            'payload' => ['array'],
            'ownerType' => ['nullable', 'required_with:ownerId', 'string', 'max:100'],
            'ownerId' => ['nullable', 'required_with:ownerType', 'string', 'max:255'],
            'profile' => ['string', 'max:100'],
            'versionId' => ['nullable', 'uuid'],
            'idempotency_key' => ['nullable', 'string', 'max:191'],
            'download' => ['boolean'],
        ];

        Validator::make($data, $rules)->validate();

        $data['download'] = (bool) $data['download'];

        /** @var array{locale: string, payload: array<string, mixed>, ownerType: string|null, ownerId: string|null, profile: string, versionId: string|null, idempotency_key: string|null, download: bool} $data */
        return $data;
    }

    /** Reject unsupported and protected fields before any native operation uses the payload.
     * @param  array<string, mixed>  $data
     * @param  list<string>  $keys
     */
    private function assertInputKeys(array $data, array $keys): void
    {
        Validator::make(['input' => $data], ['input' => ['array:'.implode(',', $keys)]])->validate();
    }
}
