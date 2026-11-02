<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Foundation\Auth\User;

/** @property int $company_id */
final class TestActor extends User
{
    protected $table = 'template_test_actors';

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['company_id' => 'integer'];
    }
}
