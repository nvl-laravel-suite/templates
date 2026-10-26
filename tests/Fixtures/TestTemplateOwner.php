<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * UUID owner used to verify assignment portability.
 */
final class TestTemplateOwner extends Model implements \Illuminate\Contracts\Auth\Authenticatable
{
    use Authenticatable;
    use HasUuids;

    /** @var string */
    protected $table = 'template_test_owners';

    /** @var list<string> */
    protected $fillable = ['name'];
}
