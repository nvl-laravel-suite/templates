<?php

declare(strict_types=1);

namespace Nvl\Templates\Support;

use Opis\JsonSchema\Info\SchemaInfo;
use Opis\JsonSchema\Keyword;
use Opis\JsonSchema\KeywordValidator;
use Opis\JsonSchema\Parsers\Keywords\PropertyNamesKeywordParser;
use Opis\JsonSchema\Parsers\SchemaParser;
use Opis\JsonSchema\Schema;

/** Keep native schema evaluation while restoring JSON's string property-name semantics. */
final class JsonPropertyNamesSchemaParser extends SchemaParser
{
    protected function parseSchemaKeywords(SchemaInfo $info, ?KeywordValidator $keywordValidator, array $parsers, object $shared, bool $hasRef = false): Schema
    {
        foreach ($parsers as $index => $parser) {
            if ($parser instanceof PropertyNamesKeywordParser) {
                $parsers[$index] = new class('propertyNames') extends PropertyNamesKeywordParser
                {
                    public function parse(SchemaInfo $info, SchemaParser $parser, object $shared): ?Keyword
                    {
                        if (parent::parse($info, $parser, $shared) === null) {
                            return null;
                        }
                        $data = $info->data();
                        $names = is_object($data) ? ($data->propertyNames ?? null) : null;
                        if (! is_bool($names) && ! is_object($names)) {
                            throw new \LogicException('The propertyNames schema must be a boolean or object.');
                        }

                        return new JsonStringPropertyNamesKeyword($names);
                    }
                };
            }
        }

        return parent::parseSchemaKeywords($info, $keywordValidator, $parsers, $shared, $hasRef);
    }
}
