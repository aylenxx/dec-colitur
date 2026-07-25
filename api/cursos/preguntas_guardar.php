<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$input = jsonInput();
$clase_id = intval($input['clase_id'] ?? 0);
$preguntas = $input['preguntas'] ?? [];

if (!$clase_id) {
    echo json_encode(['success' => false, 'message' => 'clase_id requerido']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Delete existing questions (cascade deletes options)
    $stmt = $pdo->prepare("DELETE FROM preguntas WHERE clase_id = ?");
    $stmt->execute([$clase_id]);

    // Insert new questions
    $qStmt = $pdo->prepare("INSERT INTO preguntas (clase_id, texto, orden) VALUES (?, ?, ?)");
    $oStmt = $pdo->prepare("INSERT INTO opciones (pregunta_id, texto, es_correcta, orden) VALUES (?, ?, ?, ?)");

    foreach ($preguntas as $i => $q) {
        $texto = trim($q['texto'] ?? '');
        if (!$texto) continue;
        $qStmt->execute([$clase_id, $texto, $i]);
        $preguntaId = $pdo->lastInsertId();

        $opciones = $q['opciones'] ?? [];
        foreach ($opciones as $j => $o) {
            $oTexto = trim($o['texto'] ?? '');
            if (!$oTexto) continue;
            $oStmt->execute([$preguntaId, $oTexto, !empty($o['es_correcta']) ? 1 : 0, $j]);
        }
    }

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
