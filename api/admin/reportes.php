<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

try {
    // Tasa de completitud por curso
    $completitud = $pdo->query("
        SELECT c.titulo,
            COUNT(DISTINCT m.usuario_id) AS total_est,
            COUNT(DISTINCT av.usuario_id) AS completaron,
            CASE WHEN COUNT(DISTINCT m.usuario_id) > 0
                THEN ROUND(COUNT(DISTINCT av.usuario_id) * 100.0 / COUNT(DISTINCT m.usuario_id))
                ELSE 0 END AS porcentaje
        FROM cursos c
        JOIN matriculas m ON m.curso_id = c.id
        LEFT JOIN avance_clase av ON av.usuario_id = m.usuario_id
            AND av.completada = 1
            AND av.clase_id IN (
                SELECT cl.id FROM clases cl
                JOIN modulos mo ON cl.modulo_id = mo.id
                WHERE mo.curso_id = c.id
            )
        WHERE c.estado = 'Publicado'
        GROUP BY c.id, c.titulo
        ORDER BY porcentaje DESC
    ")->fetchAll();

    // Promedio de calificaciones
    $promQuizzes = 0;
    $promTrabajos = 0;
    $promGeneral = 0;
    try {
        $row = $pdo->query("
            SELECT AVG(av.calificacion) AS prom
            FROM avance_clase av
            JOIN clases cl ON cl.id = av.clase_id
            WHERE cl.tipo_contenido = 'quiz' AND av.calificacion IS NOT NULL
        ")->fetch();
        $promQuizzes = round($row['prom'] ?? 0, 1);
    } catch (PDOException $e) { }

    try {
        $row = $pdo->query("
            SELECT AVG(t.calificacion * 5) AS prom
            FROM trabajos t
            WHERE t.calificacion IS NOT NULL
        ")->fetch();
        $promTrabajos = round($row['prom'] ?? 0, 1);
    } catch (PDOException $e) { }

    $promGeneral = round(($promQuizzes + $promTrabajos) / 2, 1);

    // Ingresos acumulados
    $ingresosRow = $pdo->query("
        SELECT COALESCE(SUM(monto), 0) AS total,
               COUNT(*) AS ventas
        FROM matriculas
        WHERE estado = 'Pagado'
    ")->fetch();
    $ingresosTotal = floatval($ingresosRow['total'] ?? 0);
    $ventasTotal = intval($ingresosRow['ventas'] ?? 0);
    $ingresoProm = $ventasTotal > 0 ? round($ingresosTotal / $ventasTotal) : 0;

    // Meses con ingresos (para subtítulo)
    $primerMes = $pdo->query("SELECT MIN(COALESCE(created_at, fecha)) FROM matriculas WHERE estado = 'Pagado'")->fetchColumn();
    $mesInicio = $primerMes ? date('M Y', strtotime($primerMes)) : 'N/A';
    $mesFin = date('M Y');

    echo json_encode([
        'success' => true,
        'data' => [
            'completitud' => $completitud,
            'prom_quizzes' => $promQuizzes,
            'prom_trabajos' => $promTrabajos,
            'prom_general' => $promGeneral,
            'ingresos_total' => $ingresosTotal,
            'ventas_total' => $ventasTotal,
            'ingreso_prom' => $ingresoProm,
            'mes_inicio' => $mesInicio,
            'mes_fin' => $mesFin,
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
