<?php
require_once __DIR__ . '/../config.php';

$data = jsonInput();

$nombres   = trim($data['nombres'] ?? '');
$apellidos = trim($data['apellidos'] ?? '');
$email     = trim($data['email'] ?? '');
$password  = $data['password'] ?? '';
$colegiado = trim($data['colegiado'] ?? '') ?: null;

if (!$nombres || !$apellidos || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Todos los campos son obligatorios']);
    exit;
}

// ¿El correo ya existe?
$stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = ?');
$stmt->execute([$email]);

if ($stmt->fetch()) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El correo ya existe']);
    exit;
}

// password_hash() es el equivalente nativo de PHP a bcrypt.hash()
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$insert = $pdo->prepare(
    'INSERT INTO usuarios (nombres, apellidos, email, password, colegiado, rol)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$insert->execute([$nombres, $apellidos, $email, $hashedPassword, $colegiado, 'usuario']);

echo json_encode([
    'success' => true,
    'message' => '✅ Usuario registrado exitosamente',
]);
