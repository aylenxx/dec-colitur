<?php
require_once __DIR__ . '/../config.php';

$data     = jsonInput();
$email    = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Correo y contraseña requeridos']);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = ?');
$stmt->execute([$email]);
$usuario = $stmt->fetch();

if (!$usuario) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
    exit;
}

// Verificar contraseña: intentar password_verify (bcrypt/argon2)
// y como fallback, comparación directa para contraseñas en texto plano legacy
$hash = $usuario['password'];
$passwordValida = false;

if (password_verify($password, $hash)) {
    $passwordValida = true;
} elseif ($hash === $password) {
    // Contraseña en texto plano: auto-upgrade a bcrypt
    $passwordValida = true;
    $nuevoHash = password_hash($password, PASSWORD_BCRYPT);
    $upd = $pdo->prepare('UPDATE usuarios SET password = ? WHERE id = ?');
    $upd->execute([$nuevoHash, $usuario['id']]);
}

if (!$passwordValida) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Contraseña incorrecta']);
    exit;
}

/*
 * AQUÍ está la gran diferencia con Node/JWT:
 * en vez de firmar un token, simplemente guardamos los datos
 * del usuario en $_SESSION. PHP crea automáticamente una cookie
 * (PHPSESSID) en el navegador que identifica esta sesión en
 * las siguientes peticiones, sin que el frontend tenga que
 * mandar ningún header manualmente.
 */
session_regenerate_id(true); // evita "session fixation" — buena práctica de seguridad
$_SESSION['user_id']   = $usuario['id'];
$_SESSION['rol']       = $usuario['rol'];
$_SESSION['nombres']   = $usuario['nombres'];
$_SESSION['apellidos'] = $usuario['apellidos'];
$_SESSION['email']     = $usuario['email'];

echo json_encode([
    'success' => true,
    'message' => '✅ Login correcto',
    'usuario' => [
        'id'        => $usuario['id'],
        'nombres'   => $usuario['nombres'],
        'apellidos' => $usuario['apellidos'],
        'email'     => $usuario['email'],
        'rol'       => $usuario['rol'],
    ],
]);
