<?php
/**
 * config.php
 * Punto de entrada común para toda la API:
 *  - Inicia la sesión de PHP (así funciona el login con cookies)
 *  - Carga las variables del archivo .env (sin librerías externas)
 *  - Abre la conexión PDO a MySQL (XAMPP)
 *  - Define una función helper para leer el body JSON del fetch()
 */

session_start();

header('Content-Type: application/json; charset=utf-8');

/* ========================================
   CARGAR VARIABLES DESDE .env
   ======================================== */
function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key   = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        $_ENV[$key] = $value;
        putenv("{$key}={$value}");
    }
}

loadEnv(__DIR__ . '/../.env');

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'dec_colitur');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

define('MAIL_USER', getenv('EMAIL_USER') ?: '');
define('MAIL_PASS', getenv('EMAIL_PASS') ?: '');

define('FRONTEND_URL', rtrim(getenv('FRONTEND_URL') ?: 'http://localhost/PHP_DEC2', '/'));

/* ========================================
   CONEXIÓN A LA BASE DE DATOS (PDO)
   ======================================== */
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error de conexión a la base de datos',
    ]);
    exit;
}

/* ========================================
   HELPER: leer el JSON que manda fetch()
   ======================================== */
function jsonInput(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}