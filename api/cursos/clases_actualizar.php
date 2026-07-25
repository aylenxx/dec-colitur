<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$data = jsonInput();
$id = intval($data['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID de clase requerido']);
    exit;
}

$titulo         = trim($data['titulo'] ?? '');
$tipo_contenido = trim($data['tipo_contenido'] ?? 'video');
$descripcion    = trim($data['descripcion'] ?? '');
$video          = trim($data['video'] ?? '');
$documento      = trim($data['documento'] ?? '');
$cuestionario   = intval($data['cuestionario'] ?? 0);
$duracion       = trim($data['duracion'] ?? '');
$orden          = intval($data['orden'] ?? 0);

if (!$titulo) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El título es obligatorio']);
    exit;
}

try {
    $check = $pdo->prepare("SELECT id FROM clases WHERE id = ?");
    $check->execute([$id]);
    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Clase no encontrada']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE clases SET titulo=?, tipo_contenido=?, descripcion=?, video=?, documento=?, cuestionario=?, duracion=?, orden=? WHERE id=?");
    $stmt->execute([$titulo, $tipo_contenido, $descripcion, $video, $documento, $cuestionario, $duracion, $orden, $id]);

    echo json_encode(['success' => true, 'message' => 'Clase actualizada exitosamente']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al actualizar clase: ' . $e->getMessage()]);
}
