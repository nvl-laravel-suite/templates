<?php

declare(strict_types=1);

namespace Nvl\Templates\Rendering;

use DOMDocument;
use DOMElement;
use Symfony\Component\CssSelector\Exception\ExceptionInterface;
use Symfony\Component\CssSelector\Parser\Parser;
use Symfony\Component\CssSelector\Parser\Reader;
use Symfony\Component\CssSelector\Parser\Tokenizer\Tokenizer;
use TijsVerkoyen\CssToInlineStyles\Css\Processor;
use TijsVerkoyen\CssToInlineStyles\Css\Property\Processor as PropertyProcessor;
use TijsVerkoyen\CssToInlineStyles\Css\Property\Property;
use TijsVerkoyen\CssToInlineStyles\Css\Rule\Rule;
use TijsVerkoyen\CssToInlineStyles\CssToInlineStyles;

/** Preserve CSS importance when merging stylesheet declarations with existing inline values. */
final class EmailCssInliner extends CssToInlineStyles
{
    public function convert($html, $css = null)
    {
        $document = $this->createDomDocumentFromHtml($html);
        $styles = (new Processor)->getCssFromStyleTags($html);
        if ($css !== null) {
            $styles .= "\n".$css;
        }

        return $this->getHtmlFromDocument($this->inline($document, $this->rules($styles)));
    }

    protected function createDomDocumentFromHtml($html)
    {
        // A UTF-8 encoding hint preserves raw style text; encoding the entire
        // document as numeric entities changes CSS selector/property values.
        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="utf-8" ?>'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        foreach (iterator_to_array($document->childNodes) as $child) {
            if ($child->nodeType === XML_PI_NODE) {
                $document->removeChild($child);
            }
        }
        $document->formatOutput = true;

        return $document;
    }

    /** @return array{string,array<string,string>} */
    private function protectLiterals(string $css): array
    {
        // Protect raw quoted literals from the dependency's comma/rule
        // splitting and quote normalization.
        $prefix = 'EMAILCSSSTRING';
        while (str_contains($css, $prefix)) {
            $prefix .= 'X';
        }
        $literals = [];
        $protected = '';
        $offset = 0;
        $tokens = (new Tokenizer)->tokenize(new Reader($css));
        while (! ($token = $tokens->getNext())->isFileEnd()) {
            if (! $token->isString()) {
                continue;
            }
            $start = $token->getPosition() - 1;
            // Symfony decodes string tokens, so their value length cannot
            // locate the closing quote in the original escaped CSS.
            $end = $start + 1;
            while ($end < strlen($css)) {
                if ($css[$end] === '\\') {
                    $end += 2;

                    continue;
                }
                if ($css[$end] === $css[$start]) {
                    break;
                }
                $end++;
            }
            $length = $end - $start + 1;
            $marker = $prefix.count($literals);
            $literals[$marker] = substr($css, $start, $length);
            $protected .= substr($css, $offset, $start - $offset).$marker;
            $offset = $start + $length;
        }

        return [$protected.substr($css, $offset), $literals];
    }

    /** @return list<Rule> */
    private function rules(string $css): array
    {
        [$css, $literals] = $this->protectLiterals($css);
        $parser = new Parser;
        $rules = [];
        foreach ((new Processor)->getRules($css) as $rule) {
            $selector = strtr($rule->getSelector(), $literals);
            try {
                $specificity = $parser->parse($selector)[0]->getSpecificity();
            } catch (ExceptionInterface) {
                // Match the dependency's handling of retained responsive rules.
                continue;
            }
            $properties = array_map(fn (Property $property) => new Property($property->getName(), strtr($property->getValue(), $literals), $specificity), $rule->getProperties());
            $rules[] = new Rule($selector, $properties, $specificity, $rule->getOrder());
        }

        return $rules;
    }

    public function getInlineStyles(DOMElement $element)
    {
        [$css, $literals] = $this->protectLiterals($element->getAttribute('style'));
        $processor = new PropertyProcessor;
        $properties = $processor->convertArrayToObjects($processor->splitIntoSeparateProperties($css));

        return array_map(fn (Property $property) => new Property($property->getName(), strtr($property->getValue(), $literals)), $properties);
    }

    public function inlineCssOnElement(DOMElement $element, array $properties)
    {
        $applied = [];
        foreach ($properties as $property) {
            $applied[$property->getName()] = $property;
        }
        foreach ($this->getInlineStyles($element) as $property) {
            $previous = $applied[$property->getName()] ?? null;
            if (! $previous || ! $previous->isImportant() || $property->isImportant()) {
                // Inline values follow stylesheet values of the same importance.
                unset($applied[$property->getName()]);
                $applied[$property->getName()] = $property;
            }
        }
        if ($applied !== []) {
            $element->setAttribute('style', implode(' ', array_map(fn ($property) => $property->toString(), $applied)));
        }

        return $element;
    }
}
