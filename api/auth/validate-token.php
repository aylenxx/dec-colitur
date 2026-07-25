<?php
require_once __DIR__ . '/../config.php';

$token = $_GET['token'] ?? '';

if (!$token) {
    http_response_code(400);
    echo json_encode(['valid' => false, 'message' => 'Token requerido']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT * FROM password_reset_tokens
     WHERE token = ? AND used = 0 AND expires_at > NOW()'
);
$stmt->execute([$token]);
$registro = $stmt->fetch();

if (!$registro) {
    echo json_encode(['valid' => false, 'message' => 'Token inválido o expirado']);
    exit;
}

echo json_encode(['valid' => true, 'email' => $registro['email']]);
