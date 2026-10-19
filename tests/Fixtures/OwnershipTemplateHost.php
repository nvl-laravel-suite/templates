<?php

declare(strict_types=1);

namespace Nvl\Templates\Tests\Fixtures;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Nvl\Content\Contracts\ContentOwner;
use Nvl\Content\Traits\HasContent;
use Nvl\Support\Config\PackageStorage;
use Nvl\Support\Ownership\Contracts\Ownable;
use Nvl\Support\Ownership\Traits\HasOwnership;
use Nvl\Support\Ownership\ValueObjects\OwnershipDefinition;

/** Native host target independent from NVL tenancy.
 * @property string $id
 * @property int $company_id
 * @property string $name
 * @property string $owner_scope_key
 */
class OwnershipTemplateHost extends Model implements ContentOwner, Ownable
{
    use HasContent, HasOwnership { HasContent::delete insteadof HasOwnership; }
    use HasUuids;

    public const array CONTENT_GROUPS = ['main'];

    protected $table = 'templates_owned_subjects';

    protected $guarded = [];

    public $timestamps = false;

    public function getConnectionName(): ?string
    {
        return PackageStorage::connection('templates');
    }

    public static function ownershipDefinition(): OwnershipDefinition
    {
        return OwnershipDefinition::column(OwnershipCompany::class, 'company_id');
    }
}
