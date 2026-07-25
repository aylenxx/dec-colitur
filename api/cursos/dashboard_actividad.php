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
    // ── ACTIVIDAD RECIENTE ──
    $stmt = $pdo->prepare("
        SELECT cl.titulo AS clase_titulo, cl.tipo_contenido,
               c.titulo AS curso_titulo, ac.fecha, ac.calificacion
        FROM avance_clase ac
        INNER JOIN clases cl ON ac.clase_id = cl.id
        INNER JOIN modulos m ON cl.modulo_id = m.id
        INNER JOIN cursos c ON m.curso_id = c.id
        INNER JOIN matriculas mt ON mt.curso_id = c.id AND mt.usuario_id = ac.usuario_id
        WHERE ac.usuario_id = ? AND ac.completada = 1 AND mt.estado = 'Pagado'
        ORDER BY ac.fecha DESC
        LIMIT 10
    ");
    $stmt->execute([$user_id]);
    $actividad = $stmt->fetchAll();

    // ── RACHA DE ESTUDIO ──
    $stmt2 = $pdo->prepare("
        SELECT DISTINCT DATE(ac.fecha) AS fecha_dia
        FROM avance_clase ac
        WHERE ac.usuario_id = ? AND ac.completada = 1
        ORDER BY fecha_dia DESC
    ");
    $stmt2->execute([$user_id]);
    $dias_raw = $stmt2->fetchAll();

    $dias = array_map(function($d) { return $d['fecha_dia']; }, $dias_raw);

    $racha = 0;
    $hoy = new DateTime('today');
    $hoy->setTime(0, 0, 0);

    if (!empty($dias)) {
        $ultimaFecha = new DateTime($dias[0]);
        $ultimaFecha->setTime(0, 0, 0);

        $diffHoy = $hoy->diff($ultimaFecha)->days;

        if ($diffHoy <= 1) {
            $racha = 1;
            $fechaComparar = $ultimaFecha;
            for ($i = 1; $i < count($dias); $i++) {
                $fechaAnterior = new DateTime($dias[$i]);
                $fechaAnterior->setTime(0, 0, 0);
                $diff = $fechaComparar->diff($fechaAnterior)->days;
                if ($diff === 1) {
                    $racha++;
                    $fechaComparar = $fechaAnterior;
                } else {
                    break;
                }
            }
        }
    }

    // ── DÍAS DE LA SEMANA (últimos 7 días con actividad) ──
    $semana = [];
    $fechaRef = clone $hoy;
    $diasSemana = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    $diasSet = array_flip($dias);

    for ($i = 6; $i >= 0; $i--) {
        $f = clone $hoy;
        $f->modify("-{$i} days");
        $fechaStr = $f->format('Y-m-d');
        $semana[] = [
            'dia' => $diasSemana[(int)$f->format('w')],
            'activo' => isset($diasSet[$fechaStr]),
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'actividad' => $actividad,
            'racha' => $racha,
            'semana' => $semana,
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
