<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$data = jsonInput();
$curso_id = intval($data['curso_id'] ?? 0);
$modulos = $data['modulos'] ?? [];

if (!$curso_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'curso_id requerido']);
    exit;
}

try {
    $pdo->beginTransaction();

    $check = $pdo->prepare("SELECT id FROM cursos WHERE id = ?");
    $check->execute([$curso_id]);
    if (!$check->fetch()) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Curso no encontrado']);
        exit;
    }

    $existing = $pdo->prepare("SELECT id, titulo, orden FROM modulos WHERE curso_id = ? ORDER BY orden");
    $existing->execute([$curso_id]);
    $existingMods = $existing->fetchAll();

    $validMods = [];
    foreach ($modulos as $mod) {
        $titulo = trim($mod['titulo'] ?? '');
        if ($titulo !== '') {
            $validMods[] = $titulo;
        }
    }

    $usedExistingIds = [];
    $orden = 1;
    $updMod = $pdo->prepare("UPDATE modulos SET titulo = ?, sesiones = ?, orden = ? WHERE id = ?");
    $insMod = $pdo->prepare("INSERT INTO modulos (curso_id, titulo, sesiones, orden) VALUES (?, ?, ?, ?)");
    $delMod = $pdo->prepare("DELETE FROM modulos WHERE id = ?");

    foreach ($validMods as $idx => $titulo) {
        $sesiones = intval($modulos[$idx]['sesiones'] ?? 0);
        if (isset($existingMods[$idx])) {
            $updMod->execute([$titulo, $sesiones, $orden, $existingMods[$idx]['id']]);
            $usedExistingIds[] = $existingMods[$idx]['id'];
        } else {
            $insMod->execute([$curso_id, $titulo, $sesiones, $orden]);
        }
        $orden++;
    }

    foreach ($existingMods as $old) {
        if (!in_array($old['id'], $usedExistingIds)) {
            $chk = $pdo->prepare("SELECT COUNT(*) FROM clases WHERE modulo_id = ?");
            $chk->execute([$old['id']]);
            $hasClases = $chk->fetchColumn() > 0;
            if (!$hasClases) {
                $delMod->execute([$old['id']]);
            }
        }
    }

    $updCurso = $pdo->prepare("UPDATE cursos SET cantidad_modulos = (SELECT COUNT(*) FROM modulos WHERE curso_id = ?) WHERE id = ?");
    $updCurso->execute([$curso_id, $curso_id]);

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Módulos sincronizados']);
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
