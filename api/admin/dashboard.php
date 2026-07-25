<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

try {
    $totalUsuarios = $pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn();
    $totalMatriculas = $pdo->query("SELECT COUNT(*) FROM matriculas")->fetchColumn();
    $totalCursos = $pdo->query("SELECT COUNT(*) FROM cursos")->fetchColumn();
    $totalCertificados = 0;
    try { $totalCertificados = $pdo->query("SELECT COUNT(*) FROM certificados_emitidos")->fetchColumn(); } catch (PDOException $e) { $totalCertificados = 0; }

    // Ingresos del mes
    $ingresosMes = $pdo->query("SELECT COALESCE(SUM(monto), 0) FROM matriculas WHERE MONTH(COALESCE(created_at, fecha)) = MONTH(CURRENT_DATE()) AND YEAR(COALESCE(created_at, fecha)) = YEAR(CURRENT_DATE()) AND estado = 'Pagado'")->fetchColumn();

    // Usuarios este mes
    $usuariosMes = $pdo->query("SELECT COUNT(*) FROM usuarios WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())")->fetchColumn();

    // Matriculas este mes
    $matriculasMes = $pdo->query("SELECT COUNT(*) FROM matriculas WHERE MONTH(COALESCE(created_at, fecha)) = MONTH(CURRENT_DATE()) AND YEAR(COALESCE(created_at, fecha)) = YEAR(CURRENT_DATE())")->fetchColumn();

    // Certificados esta semana
    $certSemana = 0;
    try { $certSemana = $pdo->query("SELECT COUNT(*) FROM certificados_emitidos WHERE YEARWEEK(fecha_emision, 1) = YEARWEEK(CURRENT_DATE(), 1)")->fetchColumn(); } catch (PDOException $e) { $certSemana = 0; }

    // Matriculas por mes (últimos 5 meses)
    $matriculasPorMes = $pdo->query("SELECT MONTH(COALESCE(created_at, fecha)) AS mes, COUNT(*) AS total FROM matriculas WHERE COALESCE(created_at, fecha) >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH) GROUP BY MONTH(COALESCE(created_at, fecha)) ORDER BY mes")->fetchAll();

    // Matriculados por curso
    $matriculasPorCurso = $pdo->query("SELECT c.titulo, COUNT(m.id) AS total FROM matriculas m JOIN cursos c ON m.curso_id = c.id GROUP BY m.curso_id ORDER BY total DESC")->fetchAll();

    // Actividad reciente (últimos 5 registros)
    $actividad = $pdo->query("(SELECT CONCAT('Nuevo usuario: ', u.nombres, ' ', u.apellidos) AS descripcion, 'usuario' AS tipo, u.created_at AS fecha FROM usuarios u ORDER BY u.created_at DESC LIMIT 2)
                              UNION ALL
                              (SELECT CONCAT('Nueva matrícula en: ', c.titulo) AS descripcion, 'matricula' AS tipo, COALESCE(m.created_at, m.fecha) AS fecha FROM matriculas m JOIN cursos c ON m.curso_id = c.id ORDER BY COALESCE(m.created_at, m.fecha) DESC LIMIT 2)
                              ORDER BY fecha DESC LIMIT 5")->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => [
            'total_usuarios' => intval($totalUsuarios),
            'total_matriculas' => intval($totalMatriculas),
            'total_cursos' => intval($totalCursos),
            'total_certificados' => intval($totalCertificados),
            'ingresos_mes' => floatval($ingresosMes),
            'usuarios_mes' => intval($usuariosMes),
            'matriculas_mes' => intval($matriculasMes),
            'cert_semana' => intval($certSemana),
            'matriculas_por_mes' => $matriculasPorMes,
            'matriculas_por_curso' => $matriculasPorCurso,
            'actividad_reciente' => $actividad,
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
