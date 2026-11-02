<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Opis\JsonSchema\Errors\ValidationError;
use Opis\JsonSchema\Keywords\PropertyNamesKeyword;
use Opis\JsonSchema\Schema;
use Opis\JsonSchema\ValidationContext;

/** PHP casts numeric object keys to integers; a JSON property name is always a string. */
final class JsonStringPropertyNamesKeyword extends PropertyNamesKeyword
{
    public function validate(ValidationContext $context, Schema $schema): ?ValidationError
    {
        if (is_bool($this->value) || ! $context->getObjectProperties()) {
            return parent::validate($context, $schema);
        }
        if (! $this->value instanceof Schema) {
            $this->value = $context->loader()->loadObjectSchema($this->value);
        }
        foreach ($context->getObjectProperties() as $name) {
            if (! is_string($name) && ! is_int($name)) {
                throw new \LogicException('A JSON property name must be a string or numeric PHP key.');
            }
            if ($error = $this->value->validate($context->newInstance((string) $name, $schema))) {
                return $this->error($schema, $context, 'propertyNames', "Property '{property}' must match schema", ['property' => (string) $name], $error);
            }
        }

        return null;
    }
}
