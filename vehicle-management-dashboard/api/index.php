<?php
declare(strict_types=1);
require_once __DIR__ . '/common.php';

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = db();
    if ($route === 'session' && $method === 'GET') {
        start_app_session();
        if (empty($_SESSION['user_id'])) json_response(['authenticated' => false]);
        $stmt = $pdo->prepare('SELECT id, username, display_name, email FROM users WHERE id = ?');
        $stmt->execute([(int)$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user) { session_destroy(); json_response(['authenticated' => false]); }
        json_response(['authenticated' => true, 'user' => $user]);
    }

    if ($route === 'login' && $method === 'POST') {
        require_same_origin();
        $input = request_json();
        $username = mb_substr(trim((string)($input['username'] ?? '')), 0, 80);
        $password = (string)($input['password'] ?? '');
        if (strlen($password) > 256) json_response(['error' => 'Username or password is incorrect'], 401);
        $ipHash = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', (string)ini_get('session.name'));
        if (login_is_throttled($pdo, $ipHash)) json_response(['error' => 'Too many sign-in attempts. Try again in 15 minutes.'], 429);
        $stmt = $pdo->prepare('SELECT id, username, display_name, email, password_hash, password_salt, password_iterations FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        $salt = $user ? hex2bin($user['password_salt']) : random_bytes(16);
        $iterations = $user ? (int)$user['password_iterations'] : 310000;
        $candidate = hash_pbkdf2('sha256', $password, $salt, $iterations, 64, false);
        $valid = $user && $password !== '' && hash_equals($user['password_hash'], $candidate);
        if (!$valid) {
            record_login_failure($pdo, $ipHash);
            json_response(['error' => 'Username or password is incorrect'], 401);
        }
        clear_login_failures($pdo, $ipHash);
        start_app_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['expires_at'] = time() + SESSION_LIFETIME;
        json_response(['authenticated' => true, 'user' => ['id' => (int)$user['id'], 'username' => $user['username'], 'display_name' => $user['display_name'], 'email' => $user['email']]]);
    }

    if ($route === 'logout' && $method === 'POST') {
        require_same_origin();
        start_app_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $params['path'], 'domain' => $params['domain'], 'secure' => $params['secure'], 'httponly' => $params['httponly'], 'samesite' => 'Strict']);
        }
        session_destroy();
        json_response(['authenticated' => false]);
    }

    $userId = require_login();
    if ($route === 'bootstrap' && $method === 'GET') {
        $records = [];
        foreach (ALLOWED_RECORD_TYPES as $type) $records[$type] = [];
        $stmt = $pdo->prepare('SELECT record_type, data FROM app_records WHERE user_id = ?');
        $stmt->execute([$userId]);
        foreach ($stmt as $row) $records[$row['record_type']][] = json_decode($row['data'], true, 64, JSON_THROW_ON_ERROR);
        $preferences = [];
        $stmt = $pdo->prepare('SELECT preferences FROM user_preferences WHERE user_id = ?');
        $stmt->execute([$userId]);
        $stored = $stmt->fetchColumn();
        if ($stored) $preferences = json_decode($stored, true, 64, JSON_THROW_ON_ERROR);
        json_response(['records' => $records, 'preferences' => $preferences]);
    }

    if ($route === 'records' && $method === 'PUT') {
        $input = request_json();
        $type = (string)($input['type'] ?? '');
        $records = $input['records'] ?? null;
        if (!in_array($type, ALLOWED_RECORD_TYPES, true) || !is_array($records) || count($records) > 5000) json_response(['error' => 'Invalid records payload'], 422);
        $pdo->beginTransaction();
        $delete = $pdo->prepare('DELETE FROM app_records WHERE user_id = ? AND record_type = ?');
        $delete->execute([$userId, $type]);
        $insert = $pdo->prepare('INSERT INTO app_records (user_id, record_type, record_key, data) VALUES (?, ?, ?, ?)');
        foreach ($records as $record) {
            if (!is_array($record)) { $pdo->rollBack(); json_response(['error' => 'Invalid record item'], 422); }
            $key = (string)($record['id'] ?? $record['ref'] ?? '');
            if ($key === '' || strlen($key) > 100) { $pdo->rollBack(); json_response(['error' => 'Every record needs a short id'], 422); }
            $json = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            if ($json === false || strlen($json) > 65535) { $pdo->rollBack(); json_response(['error' => 'Record is too large'], 422); }
            $insert->execute([$userId, $type, $key, $json]);
        }
        $pdo->commit();
        json_response(['saved' => count($records), 'type' => $type]);
    }

    if ($route === 'preferences' && $method === 'PUT') {
        $input = request_json();
        $preferences = $input['preferences'] ?? null;
        if (!is_array($preferences) || strlen(json_encode($preferences) ?: '') > 10000) json_response(['error' => 'Invalid preferences'], 422);
        $stmt = $pdo->prepare('INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?) ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)');
        $stmt->execute([$userId, json_encode($preferences, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
        json_response(['saved' => true]);
    }

    json_response(['error' => 'Not found'], 404);
} catch (Throwable $error) {
    error_log('Motiv API error: ' . $error->getMessage());
    json_response(['error' => 'The database request could not be completed. Check the XAMPP database setup.'], 500);
}
