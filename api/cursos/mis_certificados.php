<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$usuario_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? 'mis_certificados';

switch ($action) {

    case 'mis_certificados':
        try {
            $query = "SELECT 
                        ce.id AS emitido_id,
                        ce.fecha_emision,
                        ce.fecha_descarga,
                        c.id AS certificado_id,
                        c.firma1_nombre, c.firma1_cargo, c.firma1_imagen,
                        c.firma2_nombre, c.firma2_cargo, c.firma2_imagen,
                        c.firma3_nombre, c.firma3_cargo, c.firma3_imagen,
                        u.nombres AS usuario_nombres,
                        u.apellidos AS usuario_apellidos,
                        u.dni AS usuario_dni,
                        co.id AS curso_id,
                        co.titulo AS curso_titulo,
                        co.horas_duracion,
                        (SELECT COUNT(*) FROM clases cl JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = co.id) AS total_clases,
                        (SELECT COUNT(*) FROM avance_clase av JOIN clases cl ON av.clase_id = cl.id JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = co.id AND av.usuario_id = ? AND av.completada = 1) AS clases_completadas,
                        (SELECT ROUND(AVG(av2.calificacion), 1) FROM avance_clase av2 JOIN clases cl2 ON av2.clase_id = cl2.id JOIN modulos mo2 ON cl2.modulo_id = mo2.id WHERE mo2.curso_id = co.id AND av2.usuario_id = ? AND av2.calificacion IS NOT NULL) AS prom_quizzes,
                        (SELECT ROUND(AVG(t.calificacion), 1) FROM trabajos t JOIN clases cl3 ON t.clase_id = cl3.id JOIN modulos mo3 ON cl3.modulo_id = mo3.id WHERE mo3.curso_id = co.id AND t.usuario_id = ? AND t.calificacion IS NOT NULL) AS prom_trabajos
                      FROM certificados_emitidos ce
                      JOIN cursos co ON ce.curso_id = co.id
                      JOIN usuarios u ON ce.usuario_id = u.id
                      LEFT JOIN certificados c ON ce.certificado_id = c.id
                      WHERE ce.usuario_id = ?
                      ORDER BY ce.fecha_emision DESC";
            $stmt = $pdo->prepare($query);
            $stmt->execute([$usuario_id, $usuario_id, $usuario_id, $usuario_id]);
            $certs = $stmt->fetchAll();

            foreach ($certs as &$cert) {
                $quizzes = $cert['prom_quizzes'] !== null ? floatval($cert['prom_quizzes']) : null;
                $trabajos = $cert['prom_trabajos'] !== null ? floatval($cert['prom_trabajos']) : null;
                if ($quizzes !== null && $trabajos !== null) {
                    $cert['nota_final'] = round(($quizzes + $trabajos) / 2, 1);
                } elseif ($quizzes !== null) {
                    $cert['nota_final'] = $quizzes;
                } elseif ($trabajos !== null) {
                    $cert['nota_final'] = $trabajos;
                } else {
                    $cert['nota_final'] = null;
                }
                unset($cert['prom_quizzes'], $cert['prom_trabajos']);
            }

            echo json_encode(['success' => true, 'data' => $certs]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'marcar_descarga':
        try {
            $emitido_id = intval($_GET['id'] ?? 0);
            if (!$emitido_id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE certificados_emitidos SET fecha_descarga = NOW() WHERE id = ? AND usuario_id = ?");
            $stmt->execute([$emitido_id, $usuario_id]);
            echo json_encode(['success' => true, 'message' => 'Descarga registrada']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
