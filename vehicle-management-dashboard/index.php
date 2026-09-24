<?php
declare(strict_types=1);
require_once __DIR__ . '/api/common.php';
start_app_session();
if (empty($_SESSION['user_id'])) {
    header('Location: login.html', true, 302);
    exit;
}
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
readfile(__DIR__ . '/index.html');
