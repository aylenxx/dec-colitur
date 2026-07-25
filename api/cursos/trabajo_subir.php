<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$user_id = $_SESSION['user_id'];
$input = jsonInput();

$clase_id = intval($input['clase_id'] ?? 0);
$archivo_url = trim($input['archivo_url'] ?? '');
$archivo_nombre = trim($input['archivo_nombre'] ?? '');

if (!$clase_id || !$archivo_url) {
    echo json_encode(['success' => false, 'message' => 'clase_id y archivo_url son requeridos']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id FROM trabajos WHERE usuario_id = ? AND clase_id = ?");
    $stmt->execute([$user_id, $clase_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("UPDATE trabajos SET archivo = ?, fecha = NOW() WHERE id = ?");
        $stmt->execute([$archivo_url, $existing['id']]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO trabajos (usuario_id, clase_id, archivo, fecha) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$user_id, $clase_id, $archivo_url]);
    }

    echo json_encode(['success' => true, 'message' => 'Trabajo subido correctamente']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error en la base de datos: ' . $e->getMessage()]);
}
