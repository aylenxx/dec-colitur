<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$user_id = $_SESSION['user_id'];
$curso_id = intval($_GET['curso_id'] ?? 0);

if (!$curso_id) {
    echo json_encode(['success' => false, 'message' => 'curso_id requerido']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT ac.clase_id, ac.completada, ac.calificacion, ac.fecha
        FROM avance_clase ac
        INNER JOIN clases cl ON ac.clase_id = cl.id
        INNER JOIN modulos m ON cl.modulo_id = m.id
        WHERE ac.usuario_id = ? AND m.curso_id = ?
    ");
    $stmt->execute([$user_id, $curso_id]);
    $avances = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $avances
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
