<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$user_id = $_SESSION['user_id'];
$clase_id = intval($_GET['clase_id'] ?? 0);

if (!$clase_id) {
    echo json_encode(['success' => false, 'message' => 'clase_id requerido']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT id, archivo, comentario, calificacion, fecha
        FROM trabajos
        WHERE usuario_id = ? AND clase_id = ?
        LIMIT 1
    ");
    $stmt->execute([$user_id, $clase_id]);
    $trabajo = $stmt->fetch();

    if ($trabajo) {
        echo json_encode([
            'success' => true,
            'enviado' => true,
            'data' => $trabajo
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'enviado' => false,
            'data' => null
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
