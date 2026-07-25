<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$action = $_GET['action'] ?? 'listar';

switch ($action) {
    case 'listar':
        try {
            $curso_id = intval($_GET['curso_id'] ?? 0);
            $estado = $_GET['estado'] ?? '';

            $sql = "
                SELECT t.id, t.usuario_id, t.clase_id, t.archivo, t.comentario, t.calificacion, t.fecha,
                       u.nombres, u.apellidos, u.email,
                       cl.titulo AS clase_titulo, cl.descripcion AS clase_descripcion, cl.tipo_contenido,
                       mo.titulo AS modulo_titulo, mo.curso_id,
                       c.titulo AS curso_titulo
                FROM trabajos t
                JOIN usuarios u ON u.id = t.usuario_id
                JOIN clases cl ON cl.id = t.clase_id
                JOIN modulos mo ON mo.id = cl.modulo_id
                JOIN cursos c ON c.id = mo.curso_id
            ";

            $conditions = [];
            $params = [];

            if ($curso_id > 0) {
                $conditions[] = "mo.curso_id = ?";
                $params[] = $curso_id;
            }
            if ($estado === 'pendiente') {
                $conditions[] = "t.calificacion IS NULL";
            } elseif ($estado === 'calificado') {
                $conditions[] = "t.calificacion IS NOT NULL";
            }

            if ($conditions) {
                $sql .= " WHERE " . implode(" AND ", $conditions);
            }

            $sql .= " ORDER BY t.fecha DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $trabajos = $stmt->fetchAll();

            $pendientes = 0;
            $calificados = 0;
            foreach ($trabajos as $t) {
                if ($t['calificacion'] === null) $pendientes++;
                else $calificados++;
            }

            echo json_encode([
                'success' => true,
                'data' => $trabajos,
                'resumen' => [
                    'total' => count($trabajos),
                    'pendientes' => $pendientes,
                    'calificados' => $calificados,
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'detalle':
        $id = intval($_GET['id'] ?? 0);
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id requerido']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("
                SELECT t.id, t.usuario_id, t.clase_id, t.archivo, t.comentario, t.calificacion, t.fecha,
                       u.nombres, u.apellidos, u.email,
                       cl.titulo AS clase_titulo, cl.descripcion AS clase_descripcion,
                       mo.titulo AS modulo_titulo,
                       c.titulo AS curso_titulo
                FROM trabajos t
                JOIN usuarios u ON u.id = t.usuario_id
                JOIN clases cl ON cl.id = t.clase_id
                JOIN modulos mo ON mo.id = cl.modulo_id
                JOIN cursos c ON c.id = mo.curso_id
                WHERE t.id = ?
            ");
            $stmt->execute([$id]);
            $trabajo = $stmt->fetch();

            if (!$trabajo) {
                echo json_encode(['success' => false, 'message' => 'Trabajo no encontrado']);
                exit;
            }

            echo json_encode(['success' => true, 'data' => $trabajo]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'calificar':
        $input = jsonInput();
        $id = intval($input['id'] ?? 0);
        $calificacion = isset($input['calificacion']) ? floatval($input['calificacion']) : null;
        $comentario = trim($input['comentario'] ?? '');

        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id requerido']);
            exit;
        }
        if ($calificacion === null || $calificacion < 0 || $calificacion > 20) {
            echo json_encode(['success' => false, 'message' => 'La calificación debe ser entre 0 y 20']);
            exit;
        }

        try {
            $stmt = $pdo->prepare("UPDATE trabajos SET calificacion = ?, comentario = ? WHERE id = ?");
            $stmt->execute([$calificacion, $comentario, $id]);

            if ($stmt->rowCount() === 0) {
                echo json_encode(['success' => false, 'message' => 'Trabajo no encontrado']);
                exit;
            }

            $stmtT = $pdo->prepare("SELECT usuario_id, clase_id FROM trabajos WHERE id = ?");
            $stmtT->execute([$id]);
            $trabajo = $stmtT->fetch();
            if ($trabajo) {
                $stmtAV = $pdo->prepare("UPDATE avance_clase SET calificacion = ? WHERE usuario_id = ? AND clase_id = ?");
                $stmtAV->execute([$calificacion, $trabajo['usuario_id'], $trabajo['clase_id']]);
                if ($stmtAV->rowCount() === 0) {
                    $stmtAV2 = $pdo->prepare("INSERT INTO avance_clase (usuario_id, clase_id, completada, calificacion) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE calificacion = ?");
                    $stmtAV2->execute([$trabajo['usuario_id'], $trabajo['clase_id'], $calificacion, $calificacion]);
                }
            }

            echo json_encode(['success' => true, 'message' => 'Trabajo calificado correctamente']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
