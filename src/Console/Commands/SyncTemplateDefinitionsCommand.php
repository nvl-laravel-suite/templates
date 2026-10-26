<?php

declare(strict_types=1);

namespace Nvl\Templates\Console\Commands;

use Illuminate\Console\Command;
use InvalidArgumentException;
use Nvl\Support\Enums\SystemActor;
use Nvl\Templates\Services\TemplateDefinitions;

/**
 * Reports or applies an atomic source-definition synchronization plan.
 */
final class SyncTemplateDefinitionsCommand extends Command
{
    /** @var string */
    protected $signature = 'nvl:templates:sync {--dry-run} {--format=text}';

    /** @var string */
    protected $description = 'Synchronize registered template definitions into the database';

    /**
     * Plan or synchronize source definitions and archive removed keys.
     */
    public function handle(TemplateDefinitions $action): int
    {
        $format = $this->option('format');

        if (! is_string($format) || ! in_array($format, ['text', 'json'], true)) {
            throw new InvalidArgumentException(
                'The nvl:templates:sync format must be text or json.',
            );
        }

        $plan = $action->sync(SystemActor::Background, (bool) $this->option('dry-run'));

        if ($format === 'json') {
            $this->line((string) json_encode(
                $plan
                    ->map(
                        static fn (array $item): array => $item,
                    )
                    ->all(),
                JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR,
            ));
        } else {
            foreach ($plan as $item) {
                $this->line("{$item['operation']}: {$item['key']}");
            }
        }

        return self::SUCCESS;
    }
}
