<?php
require_once __DIR__ . '/../config.php';

$clase_id = intval($_GET['clase_id'] ?? 0);
if (!$clase_id) {
    echo json_encode(['success' => false, 'message' => 'clase_id requerido']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM preguntas WHERE clase_id = ? ORDER BY orden");
    $stmt->execute([$clase_id]);
    $preguntas = $stmt->fetchAll();

    foreach ($preguntas as &$p) {
        $stmt2 = $pdo->prepare("SELECT * FROM opciones WHERE pregunta_id = ? ORDER BY orden");
        $stmt2->execute([$p['id']]);
        $p['opciones'] = $stmt2->fetchAll();
    }

    echo json_encode(['success' => true, 'data' => $preguntas]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
