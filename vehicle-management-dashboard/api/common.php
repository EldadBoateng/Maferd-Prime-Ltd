<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';

const SESSION_LIFETIME = 28800;
const ALLOWED_RECORD_TYPES = ['vehicles', 'shipments', 'customers', 'drivers', 'maintenance', 'expenses'];

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Strict');
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function json_response(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 2_000_000) json_response(['error' => 'Request is too large'], 413);
    try {
        $data = json_decode($raw ?: '{}', true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_response(['error' => 'Invalid JSON request'], 400);
    }
    if (!is_array($data)) json_response(['error' => 'Invalid request body'], 400);
    return $data;
}

function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = explode(':', $_SERVER['HTTP_HOST'] ?? '', 2)[0];
    if (!is_string($originHost) || !hash_equals(strtolower($requestHost), strtolower($originHost))) {
        json_response(['error' => 'Request origin not allowed'], 403);
    }
}

function require_login(): int
{
    start_app_session();
    if (empty($_SESSION['user_id'])) json_response(['error' => 'Please sign in'], 401);
    return (int)$_SESSION['user_id'];
}

function login_is_throttled(PDO $pdo, string $ipHash): bool
{
    $statement = $pdo->prepare('SELECT failures, window_started_at, locked_until FROM login_attempts WHERE ip_hash = ?');
    $statement->execute([$ipHash]);
    $row = $statement->fetch();
    return $row && $row['locked_until'] !== null && strtotime($row['locked_until']) > time();
}

function record_login_failure(PDO $pdo, string $ipHash): void
{
    $statement = $pdo->prepare('SELECT failures, window_started_at FROM login_attempts WHERE ip_hash = ?');
    $statement->execute([$ipHash]);
    $row = $statement->fetch();
    $now = new DateTimeImmutable('now');
    $windowStarted = $row ? new DateTimeImmutable($row['window_started_at']) : $now;
    if (!$row || $windowStarted < $now->modify('-15 minutes')) {
        $failures = 1;
        $windowStarted = $now;
    } else {
        $failures = (int)$row['failures'] + 1;
    }
    $lockedUntil = $failures >= 8 ? $now->modify('+15 minutes')->format('Y-m-d H:i:s') : null;
    $upsert = $pdo->prepare('INSERT INTO login_attempts (ip_hash, failures, window_started_at, locked_until) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE failures = VALUES(failures), window_started_at = VALUES(window_started_at), locked_until = VALUES(locked_until)');
    $upsert->execute([$ipHash, $failures, $windowStarted->format('Y-m-d H:i:s'), $lockedUntil]);
}

function clear_login_failures(PDO $pdo, string $ipHash): void
{
    $statement = $pdo->prepare('DELETE FROM login_attempts WHERE ip_hash = ?');
    $statement->execute([$ipHash]);
}
