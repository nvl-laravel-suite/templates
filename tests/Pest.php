<?php

declare(strict_types=1);
use Illuminate\Support\Str;
use Nvl\Templates\Tests\Fixtures\TestTemplateOwner;
use Nvl\Templates\Tests\TestCase;

pest()->extend(TestCase::class)->in('ArchitectureTest.php', 'Feature');

function templateTestActor(?string $identity = null): TestTemplateOwner
{
    $model = TestTemplateOwner::query();
    if ($identity !== null && Str::isUuid($identity)) {
        return $model->firstOrCreate(['id' => $identity], ['name' => 'Actor '.$identity]);
    }

    return $model->firstOrCreate(['name' => $identity ?? 'Actor '.Str::uuid()]);
}
