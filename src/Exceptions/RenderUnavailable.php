<?php

declare(strict_types=1);

namespace Nvl\Templates\Exceptions;

/**
 * Retained output is expired or has not completed.
 *
 * @api
 */
final class RenderUnavailable extends \RuntimeException {}
