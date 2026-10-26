<!doctype html>
<html lang="{{ $options->locale }}">
<head>
    <meta charset="utf-8">
    <title>{{ $options->subject }}</title>
</head>
<body>
    <h1>{{ app(\Nvl\Templates\Services\TemplateContentGuard::class)->compositionValue($composition ?? [], 'body.heading') }}</h1>
    <p>{{ $data['name'] ?? '' }}</p>
</body>
</html>
