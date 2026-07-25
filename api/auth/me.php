<?php
/**
 * me.php
 * Devuelve los datos del usuario actualmente logueado, según la sesión
 * de PHP (cookie PHPSESSID). Lo llama dashboard.html y admin.html al
 * cargar la página, para pintar el avatar y el nombre con datos reales.
 *
 * Si no hay sesión activa, devuelve success:false — el frontend debe
 * redirigir a index.html en ese caso (no dejar ver la página protegida).
 */
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'No hay sesión activa',
    ]);
    exit;
}

// Traemos los datos frescos desde la base de datos (no solo de $_SESSION),
// por si el usuario actualizó su nombre/colegiado en otro momento.
$stmt = $pdo->prepare('SELECT id, nombres, apellidos, email, telefono, colegiado, rol FROM usuarios WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$usuario = $stmt->fetch();

if (!$usuario) {
    // El usuario fue borrado de la BD pero la sesión seguía activa
    session_destroy();
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
    exit;
}

echo json_encode([
    'success' => true,
    'usuario' => $usuario,
]);