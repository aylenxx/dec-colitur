<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare("
        SELECT c.id AS curso_id, c.titulo, c.duracion, c.certificacion,
               cl.id AS clase_id, cl.tipo_contenido, cl.duracion AS clase_duracion
        FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        JOIN modulos mo ON mo.curso_id = c.id
        JOIN clases cl ON cl.modulo_id = mo.id
        WHERE m.usuario_id = ? AND m.estado = 'Pagado'
        ORDER BY c.id, cl.orden
    ");
    $stmt->execute([$user_id]);
    $rows = $stmt->fetchAll();

    $cursos_ids = [];
    $total_clases = 0;
    $completadas = 0;
    $horas_estudio = 0;
    $clases_por_curso = [];
    $completadas_por_curso = [];

    foreach ($rows as $r) {
        $cid = $r['curso_id'];
        if (!in_array($cid, $cursos_ids)) {
            $cursos_ids[] = $cid;
        }
        if (!isset($clases_por_curso[$cid])) $clases_por_curso[$cid] = 0;
        if (!isset($completadas_por_curso[$cid])) $completadas_por_curso[$cid] = 0;
        $clases_por_curso[$cid]++;
        $total_clases++;
    }

    $stmt2 = $pdo->prepare("
        SELECT ac.clase_id, ac.completada, ac.calificacion,
               cl.tipo_contenido, cl.duracion AS clase_duracion,
               mo.curso_id
        FROM avance_clase ac
        INNER JOIN clases cl ON ac.clase_id = cl.id
        INNER JOIN modulos mo ON cl.modulo_id = mo.id
        INNER JOIN matriculas m ON m.curso_id = mo.curso_id AND m.usuario_id = ac.usuario_id
        WHERE ac.usuario_id = ? AND ac.completada = 1 AND m.estado = 'Pagado'
    ");
    $stmt2->execute([$user_id]);
    $completadas_rows = $stmt2->fetchAll();

    foreach ($completadas_rows as $cr) {
        $completadas++;
        $cid = $cr['curso_id'];
        if (isset($completadas_por_curso[$cid])) $completadas_por_curso[$cid]++;

        if ($cr['tipo_contenido'] === 'video' && $cr['clase_duracion']) {
            $parts = explode(':', $cr['clase_duracion']);
            if (count($parts) === 2) {
                $horas_estudio += intval($parts[0]) + intval($parts[1]) / 60;
            }
        }
    }

    $stmt3 = $pdo->prepare("
        SELECT DISTINCT curso_id
        FROM certificados_emitidos
        WHERE usuario_id = ?
    ");
    $stmt3->execute([$user_id]);
    $cursos_con_emitido = $stmt3->fetchAll(PDO::FETCH_COLUMN);
    $certificados_obtenidos = count($cursos_con_emitido);

    $cursos_elegibles_cert = [];
    foreach ($cursos_ids as $cid) {
        $cert_row = array_filter($rows, fn($r) => $r['curso_id'] === $cid);
        $cert_row = reset($cert_row);
        if ($cert_row && strtolower(substr($cert_row['certificacion'] ?? '', 0, 1)) === 's') {
            $total = $clases_por_curso[$cid] ?? 0;
            $done = $completadas_por_curso[$cid] ?? 0;
            if ($total > 0 && $done >= $total && !in_array($cid, $cursos_con_emitido)) {
                $cursos_elegibles_cert[] = $cid;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'cursos_inscritos' => count($cursos_ids),
            'lecciones_completadas' => $completadas,
            'lecciones_totales' => $total_clases,
            'horas_estudio' => round($horas_estudio),
            'certificados' => $certificados_obtenidos,
            'certificados_pendientes' => count($cursos_elegibles_cert),
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
