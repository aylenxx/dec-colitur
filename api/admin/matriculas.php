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
            $query = "SELECT m.*, 
                             u.nombres AS usuario_nombres, u.apellidos AS usuario_apellidos, u.email AS usuario_email, u.colegiado,
                             c.titulo AS curso_titulo, c.precio AS curso_precio,
                             (SELECT COUNT(*) FROM clases cl2 JOIN modulos mo2 ON cl2.modulo_id = mo2.id WHERE mo2.curso_id = m.curso_id) AS total_clases,
                             (SELECT COUNT(*) FROM avance_clase av2 JOIN clases cl3 ON av2.clase_id = cl3.id JOIN modulos mo3 ON cl3.modulo_id = mo3.id WHERE mo3.curso_id = m.curso_id AND av2.usuario_id = m.usuario_id AND av2.completada = 1) AS clases_completadas
                      FROM matriculas m
                      JOIN usuarios u ON m.usuario_id = u.id
                      JOIN cursos c ON m.curso_id = c.id
                      ORDER BY COALESCE(m.created_at, m.fecha) DESC";
            $stmt = $pdo->query($query);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'crear':
        $data = jsonInput();
        $usuario_id = intval($data['usuario_id'] ?? 0);
        $curso_id = intval($data['curso_id'] ?? 0);
        $monto = floatval($data['monto'] ?? 0);
        $medio_pago = trim($data['medio_pago'] ?? '');
        $estado = trim($data['estado'] ?? 'Pendiente');
        $fecha = trim($data['fecha'] ?? '');

        if (!$usuario_id || !$curso_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Usuario y curso son obligatorios']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM matriculas WHERE usuario_id = ? AND curso_id = ?");
        $check->execute([$usuario_id, $curso_id]);
        if ($check->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Este usuario ya está matriculado en este curso']);
            exit;
        }

        $fechaVal = $fecha ? $fecha . ' 00:00:00' : date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("INSERT INTO matriculas (usuario_id, curso_id, monto, medio_pago, estado, fecha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$usuario_id, $curso_id, $monto, $medio_pago, $estado, $fechaVal, $fechaVal]);

        echo json_encode(['success' => true, 'message' => 'Matrícula registrada', 'id' => $pdo->lastInsertId()]);
        break;

    case 'eliminar':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM matriculas WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Matrícula eliminada']);
        break;

    case 'actualizar_pago':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        $estado = trim($data['estado'] ?? '');
        if (!$id || !$estado) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID y estado requeridos']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE matriculas SET estado=? WHERE id=?");
        $stmt->execute([$estado, $id]);
        echo json_encode(['success' => true, 'message' => 'Estado de pago actualizado']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
