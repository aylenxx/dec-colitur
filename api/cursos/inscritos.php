<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$action = $_GET['action'] ?? 'listar';
$curso_id = intval($_GET['curso_id'] ?? 0);

switch ($action) {
    case 'listar':
        if (!$curso_id) {
            echo json_encode(['success' => false, 'message' => 'curso_id requerido']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT m.id AS matricula_id, m.estado AS matricula_estado, m.fecha,
                   u.id AS usuario_id, u.nombres, u.apellidos, u.email, u.colegiado
            FROM matriculas m
            JOIN usuarios u ON u.id = m.usuario_id
            WHERE m.curso_id = ? AND m.estado != 'Anulado'
            ORDER BY u.apellidos, u.nombres
        ");
        $stmt->execute([$curso_id]);
        $inscritos = $stmt->fetchAll();

        $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM modulos WHERE curso_id = ?");
        $stmtTotal->execute([$curso_id]);
        $totalModulos = (int) $stmtTotal->fetchColumn();

        $stmtClases = $pdo->prepare("
            SELECT c.id, c.tipo_contenido
            FROM clases c
            JOIN modulos m ON m.id = c.modulo_id
            WHERE m.curso_id = ?
        ");
        $stmtClases->execute([$curso_id]);
        $allClases = $stmtClases->fetchAll();
        $totalClases = count($allClases);

        $stmtPreguntas = $pdo->prepare("
            SELECT p.clase_id, COUNT(*) AS cnt
            FROM preguntas p
            JOIN clases c ON c.id = p.clase_id
            JOIN modulos m ON m.id = c.modulo_id
            WHERE m.curso_id = ?
            GROUP BY p.clase_id
        ");
        $stmtPreguntas->execute([$curso_id]);
        $preguntasMap = [];
        foreach ($stmtPreguntas->fetchAll() as $row) {
            $preguntasMap[$row['clase_id']] = (int) $row['cnt'];
        }

        $result = [];
        foreach ($inscritos as $ins) {
            $stmtAvance = $pdo->prepare("
                SELECT a.clase_id, a.completada, a.calificacion
                FROM avance_clase a
                JOIN clases cl ON cl.id = a.clase_id
                JOIN modulos mo ON mo.id = cl.modulo_id
                WHERE a.usuario_id = ? AND mo.curso_id = ?
            ");
            $stmtAvance->execute([$ins['usuario_id'], $curso_id]);
            $avances = $stmtAvance->fetchAll();

            $clasesCompletadas = 0;
            $calificaciones = [];
            foreach ($avances as $av) {
                if ($av['completada']) $clasesCompletadas++;
                if ($av['calificacion'] !== null) $calificaciones[] = (float) $av['calificacion'];
            }

            $progreso = $totalClases > 0 ? round(($clasesCompletadas / $totalClases) * 100) : 0;
            $promedio = count($calificaciones) > 0 ? round(array_sum($calificaciones) / count($calificaciones), 1) : null;

            $stmtTrabajos = $pdo->prepare("
                SELECT t.id, t.calificacion
                FROM trabajos t
                JOIN clases cl ON cl.id = t.clase_id
                JOIN modulos mo ON mo.id = cl.modulo_id
                WHERE t.usuario_id = ? AND mo.curso_id = ?
            ");
            $stmtTrabajos->execute([$ins['usuario_id'], $curso_id]);
            $trabajos = $stmtTrabajos->fetchAll();

            $trabajosEntregados = count($trabajos);
            $trabajosCalificados = 0;
            foreach ($trabajos as $t) {
                if ($t['calificacion'] !== null) $trabajosCalificados++;
            }

            $result[] = [
                'matricula_id' => $ins['matricula_id'],
                'usuario_id' => $ins['usuario_id'],
                'nombres' => $ins['nombres'],
                'apellidos' => $ins['apellidos'],
                'email' => $ins['email'],
                'colegiado' => $ins['colegiado'],
                'matricula_estado' => $ins['matricula_estado'],
                'fecha_matricula' => $ins['fecha'],
                'progreso' => $progreso,
                'clases_completadas' => $clasesCompletadas,
                'total_clases' => $totalClases,
                'promedio' => $promedio,
                'trabajos_entregados' => $trabajosEntregados,
                'trabajos_calificados' => $trabajosCalificados,
            ];
        }

        echo json_encode([
            'success' => true,
            'data' => $result,
            'resumen' => [
                'total_inscritos' => count($result),
                'total_modulos' => $totalModulos,
                'total_clases' => $totalClases,
            ]
        ]);
        break;

    case 'clases_preguntas':
        if (!$curso_id) {
            echo json_encode(['success' => false, 'message' => 'curso_id requerido']);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT c.id, c.titulo, c.tipo_contenido, c.cuestionario,
                   COUNT(p.id) AS num_preguntas
            FROM clases c
            JOIN modulos m ON m.id = c.modulo_id
            LEFT JOIN preguntas p ON p.clase_id = c.id
            WHERE m.curso_id = ?
            GROUP BY c.id
            ORDER BY m.orden, c.orden
        ");
        $stmt->execute([$curso_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
