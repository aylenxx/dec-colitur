<?php
require_once __DIR__ . '/../config.php';

$data     = jsonInput();
$token    = $data['token'] ?? '';
$password = $data['password'] ?? '';

if (!$token || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Token y contraseña requeridos']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT * FROM password_reset_tokens
     WHERE token = ? AND used = 0 AND expires_at > NOW()'
);
$stmt->execute([$token]);
$registro = $stmt->fetch();

if (!$registro) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Token inválido o expirado']);
    exit;
}

$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$pdo->prepare('UPDATE usuarios SET password = ? WHERE email = ?')
    ->execute([$hashedPassword, $registro['email']]);

$pdo->prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?')
    ->execute([$token]);

echo json_encode(['success' => true, 'message' => 'Contraseña actualizada exitosamente']);
