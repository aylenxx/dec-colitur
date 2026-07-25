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
$completada = intval($input['completada'] ?? 1);
$calificacion = isset($input['calificacion']) ? floatval($input['calificacion']) : null;

if (!$clase_id) {
    echo json_encode(['success' => false, 'message' => 'clase_id requerido']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT id FROM avance_clase WHERE usuario_id = ? AND clase_id = ?
    ");
    $stmt->execute([$user_id, $clase_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("
            UPDATE avance_clase
            SET completada = ?, calificacion = COALESCE(?, calificacion), fecha = NOW()
            WHERE usuario_id = ? AND clase_id = ?
        ");
        $stmt->execute([$completada, $calificacion, $user_id, $clase_id]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO avance_clase (usuario_id, clase_id, completada, calificacion, fecha)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$user_id, $clase_id, $completada, $calificacion]);
    }

    echo json_encode(['success' => true, 'message' => 'Avance guardado']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
