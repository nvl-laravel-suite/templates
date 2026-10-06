<?php

declare(strict_types=1);

namespace Nvl\Templates\Console;

use Illuminate\Console\Command;
use InvalidArgumentException;
use Nvl\Templates\Services\TemplatesDoctor;

/**
 * Renders the package-owned read-only installation diagnostics.
 */
final class TemplatesDoctorCommand extends Command
{
    protected $signature = 'nvl:templates:doctor
        {--strict : Return failure when a required check is unhealthy}
        {--scope=all : Inspect core, database, or all capabilities}
        {--format=text : Output text or json}';

    /** @var string */
    protected $description = 'Inspect the NVL Templates installation without changing state';

    /**
     * Inspect the requested package capabilities without mutating them.
     */
    public function handle(TemplatesDoctor $doctor): int
    {

        $format = $this->option('format');
        $scope = $this->option('scope');

        if (! is_string($format) || ! in_array($format, ['text', 'json'], true)) {
            throw new InvalidArgumentException(
                'The nvl:templates:doctor format must be text or json.',
            );
        }

        if (! is_string($scope) || ! in_array($scope, ['all', 'core', 'database'], true)) {
            throw new InvalidArgumentException(
                'The nvl:templates:doctor scope must be all, core, or database.',
            );
        }

        $checks = $doctor->inspect((string) $this->option('scope'));
        $healthy = $checks['healthy'];

        if ($format === 'json') {
            $this->line((string) json_encode(
                $checks,
                JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR,
            ));
        } else {
            foreach ($checks as $check => $value) {
                $this->line(sprintf(
                    '%-34s %s',
                    $check,
                    json_encode($value, JSON_THROW_ON_ERROR),
                ));
            }
        }

        return $healthy || ! $this->option('strict')
            ? self::SUCCESS
            : self::FAILURE;
    }
}
