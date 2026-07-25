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
    echo json_encode(['success' => false, 'message' => 'ID del curso requerido']);
    exit;
}

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
$estado            = trim($data['estado'] ?? '');

try {
    $check = $pdo->prepare("SELECT id FROM cursos WHERE id = ?");
    $check->execute([$id]);
    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Curso no encontrado']);
        exit;
    }

    $sql = "UPDATE cursos SET titulo=?, descripcion_breve=?, descripcion_ampliada=?, aprenderas=?, descripcion_curriculum=?, categoria_id=?, docente_id=?, precio=?, nivel=?, duracion=?, cantidad_sesiones=?, certificacion=?, imagen=?, badge=?, badge_descripcion=?";
    $params = [
        $titulo, $descripcion_breve, $descripcion_ampliada, $aprenderas,
        $descripcion_curriculum, $categoria_id, $docente_id, $precio,
        $nivel, $duracion, $cantidad_sesiones, $certificacion,
        $imagen, $badge, $badge_descripcion,
    ];

    if ($estado !== '') {
        $sql .= ", estado=?";
        $params[] = $estado;
    }

    $sql .= " WHERE id=?";
    $params[] = $id;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['success' => true, 'message' => 'Curso actualizado exitosamente']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al actualizar curso: ' . $e->getMessage()]);
}
