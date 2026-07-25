<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$data = jsonInput();

$titulo            = trim($data['titulo'] ?? '');
$descripcion_breve = trim($data['descripcion_breve'] ?? '');
$descripcion_ampliada = trim($data['descripcion_ampliada'] ?? '');
$aprenderas        = trim($data['aprenderas'] ?? '');
$descripcion_curriculum = trim($data['descripcion_curriculum'] ?? '');
$categoria_id      = intval($data['categoria_id'] ?? 0);
$docente_id        = intval($data['docente_id'] ?? 0);
$precio            = floatval($data['precio'] ?? 0);
$nivel             = trim($data['nivel'] ?? '');
$duracion          = trim($data['duracion'] ?? '');
$cantidad_sesiones = intval($data['cantidad_sesiones'] ?? 0);
$certificacion     = trim($data['certificacion'] ?? '');
$imagen            = trim($data['imagen'] ?? '');
$badge             = trim($data['badge'] ?? '');
$badge_descripcion = trim($data['badge_descripcion'] ?? '');
$estado            = trim($data['estado'] ?? 'Borrador');

if (!$titulo) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El título es obligatorio']);
    exit;
}

try {
    $stmt = $pdo->prepare("INSERT INTO cursos (titulo, descripcion_breve, descripcion_ampliada, aprenderas, descripcion_curriculum, categoria_id, docente_id, precio, nivel, duracion, cantidad_sesiones, certificacion, imagen, badge, badge_descripcion, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $titulo, $descripcion_breve, $descripcion_ampliada, $aprenderas,
        $descripcion_curriculum, $categoria_id, $docente_id, $precio,
        $nivel, $duracion, $cantidad_sesiones, $certificacion,
        $imagen, $badge, $badge_descripcion, $estado,
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Curso creado exitosamente',
        'id' => $pdo->lastInsertId(),
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al crear curso: ' . $e->getMessage()]);
}
