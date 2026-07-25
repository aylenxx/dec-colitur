<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$data = jsonInput();

$modulo_id      = intval($data['modulo_id'] ?? 0);
$titulo         = trim($data['titulo'] ?? '');
$tipo_contenido = trim($data['tipo_contenido'] ?? 'video');
$descripcion    = trim($data['descripcion'] ?? '');
$video          = trim($data['video'] ?? '');
$documento      = trim($data['documento'] ?? '');
$cuestionario   = intval($data['cuestionario'] ?? 0);
$duracion       = trim($data['duracion'] ?? '');
$orden          = intval($data['orden'] ?? 0);

if (!$modulo_id || !$titulo) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El módulo y el título son obligatorios']);
    exit;
}

try {
    if ($orden <= 0) {
        $stmt = $pdo->prepare("SELECT COALESCE(MAX(orden),0)+1 FROM clases WHERE modulo_id = ?");
        $stmt->execute([$modulo_id]);
        $orden = intval($stmt->fetchColumn());
    }

    $stmt = $pdo->prepare("INSERT INTO clases (modulo_id, titulo, tipo_contenido, descripcion, video, documento, cuestionario, duracion, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$modulo_id, $titulo, $tipo_contenido, $descripcion, $video, $documento, $cuestionario, $duracion, $orden]);

    echo json_encode([
        'success' => true,
        'message' => 'Clase creada exitosamente',
        'id' => $pdo->lastInsertId(),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al crear clase: ' . $e->getMessage()]);
}
