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
        SELECT c.id, c.titulo, c.certificacion
        FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        WHERE m.usuario_id = ? AND m.estado = 'Pagado'
        ORDER BY m.fecha DESC
    ");
    $stmt->execute([$user_id]);
    $cursos = $stmt->fetchAll();

    $resultado = [];

    foreach ($cursos as $curso) {
        $cid = $curso['id'];

        $stmt2 = $pdo->prepare("
            SELECT cl.id, cl.tipo_contenido
            FROM clases cl
            INNER JOIN modulos mo ON cl.modulo_id = mo.id
            WHERE mo.curso_id = ?
            ORDER BY mo.orden, cl.orden
        ");
        $stmt2->execute([$cid]);
        $clases = $stmt2->fetchAll();

        $total = count($clases);
        $completadas = 0;
        $videos_total = 0;
        $videos_done = 0;
        $quizzes_total = 0;
        $quizzes_done = 0;
        $works_total = 0;
        $works_done = 0;

        $clase_ids = array_column($clases, 'id');

        foreach ($clases as $cl) {
            if ($cl['tipo_contenido'] === 'video') $videos_total++;
            elseif ($cl['tipo_contenido'] === 'quiz') $quizzes_total++;
            elseif ($cl['tipo_contenido'] === 'trabajo') $works_total++;
        }

        if (!empty($clase_ids)) {
            $placeholders = implode(',', array_fill(0, count($clase_ids), '?'));
            $stmt3 = $pdo->prepare("
                SELECT clase_id, completada, calificacion
                FROM avance_clase
                WHERE usuario_id = ? AND clase_id IN ($placeholders)
            ");
            $params = array_merge([$user_id], $clase_ids);
            $stmt3->execute($params);
            $avances = $stmt3->fetchAll();

            foreach ($avances as $av) {
                if ($av['completada']) {
                    $completadas++;
                }
            }

            $clase_map = [];
            foreach ($clases as $cl) $clase_map[$cl['id']] = $cl['tipo_contenido'];

            foreach ($avances as $av) {
                if ($av['completada']) {
                    $tipo = $clase_map[$av['clase_id']] ?? '';
                    if ($tipo === 'video') $videos_done++;
                    elseif ($tipo === 'quiz') $quizzes_done++;
                    elseif ($tipo === 'trabajo') $works_done++;
                }
            }
        }

        $pct = $total > 0 ? round($completadas / $total * 100) : 0;

        $resultado[] = [
            'id' => $cid,
            'titulo' => $curso['titulo'],
            'certificacion' => $curso['certificacion'],
            'total_lecciones' => $total,
            'completadas' => $completadas,
            'porcentaje' => $pct,
            'videos_total' => $videos_total,
            'videos_done' => $videos_done,
            'quizzes_total' => $quizzes_total,
            'quizzes_done' => $quizzes_done,
            'works_total' => $works_total,
            'works_done' => $works_done,
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $resultado
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
