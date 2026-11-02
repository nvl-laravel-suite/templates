<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Document\Ownership;

use Illuminate\Database\Eloquent\Model;

final class TestCompany extends Model
{
    protected $table = 'template_test_companies';

    protected $guarded = [];

    public $timestamps = false;
}
