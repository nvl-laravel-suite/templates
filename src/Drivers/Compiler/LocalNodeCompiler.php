<?php

declare(strict_types=1);

namespace Nvl\Templates\Drivers\Compiler;

use Illuminate\Validation\ValidationException;
use Nvl\Templates\Contracts\DocumentCompiler;
use Nvl\Templates\Exceptions\RetryableRenderException;
use Nvl\Templates\Support\JsonWire;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

/**
 * Trusted local Node adapter for the shared portable compiler.
 *
 * @api
 */
final class LocalNodeCompiler implements DocumentCompiler
{
    public function compile(array $document, array $data, array $assets = []): array
    {
        $command = config('nvl-templates.compiler.command');
        if (! is_array($command) || $command === []) {
            $this->fail('Configure a trusted compiler command argument array.');
        }
        $arguments = [];
        foreach ($command as $part) {
            if (! is_string($part) || str_contains($part, "\0")) {
                $this->fail('Configure a trusted compiler command argument array.');
            }
            $arguments[] = $part;
        }
        $cwd = config('nvl-templates.compiler.cwd');
        if ($cwd !== null && ! is_string($cwd)) {
            $this->fail('Configure a compiler working directory string or null.');
        }
        $limit = config('nvl-templates.limits.output_bytes');
        if (! is_int($limit) || $limit < 1) {
            $this->fail('Configure a positive compiler byte limit.');
        }
        $timeout = config('nvl-templates.compiler.timeout', 30);
        if (! is_numeric($timeout) || ! is_finite((float) $timeout) || (float) $timeout <= 0) {
            $this->fail('Configure a finite positive compiler timeout.');
        }
        $schema = $document['dataSchema'] ?? null;
        if (! is_array($schema)) {
            $this->fail('The compiler document requires a data schema.');
        }
        $data = JsonWire::value($data, $schema);
        $document = JsonWire::document($document);
        $assets = (object) $assets;
        $input = json_encode(compact('document', 'data', 'assets'), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($input) > $limit) {
            $this->fail('Prepared compiler input exceeds the byte limit.');
        }
        $process = new Process($arguments, $cwd, timeout: (float) $timeout);
        $process->setInput($input);
        $bytes = 0;
        try {
            $process->run(function ($type, $chunk) use (&$bytes, $limit): void {
                $bytes += strlen($chunk);
                if ($bytes > $limit) {
                    throw new \RuntimeException('Compiler output exceeds its limit.');
                }
            });
            if (! $process->isSuccessful()) {
                $this->fail('The shared compiler failed; inspect its configuration and document compatibility.');
            }
            $output = json_decode($process->getOutput(), true, 64, JSON_THROW_ON_ERROR);
            if (! is_array($output) || ! is_string($output['html'] ?? null) || $output['html'] === '' || ! is_string($output['css'] ?? null)) {
                $this->fail('The shared compiler returned an invalid result.');
            }

            $result = ['html' => $output['html'], 'css' => $output['css']];
            foreach (['subject', 'text'] as $field) {
                if (array_key_exists($field, $output)) {
                    if ($output[$field] !== null && ! is_string($output[$field])) {
                        $this->fail('The shared compiler returned an invalid email sidecar.');
                    }
                    $result[$field] = $output[$field];
                }
            }

            return $result;
        } catch (ProcessTimedOutException) {
            throw new RetryableRenderException('compiler_timeout');
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable) {
            $this->fail('The shared compiler is unavailable, timed out, or returned invalid output.');
        } finally {
            if ($process->isRunning()) {
                $process->stop(0);
            }
        }
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['compiler' => [$message]]);
    }
}
