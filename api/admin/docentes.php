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
        $stmt = $pdo->query("SELECT * FROM docentes ORDER BY nombres");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    case 'crear':
        $data = jsonInput();
        $nombres = trim($data['nombres'] ?? '');
        $profesion = trim($data['profesion'] ?? '');
        $descripcion = trim($data['descripcion'] ?? '');

        if (!$nombres) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nombre del docente requerido']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO docentes (nombres, profesion, descripcion) VALUES (?, ?, ?)");
        $stmt->execute([$nombres, $profesion, $descripcion]);
        echo json_encode(['success' => true, 'message' => 'Docente registrado', 'id' => $pdo->lastInsertId()]);
        break;

    case 'actualizar':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $nombres = trim($data['nombres'] ?? '');
        $profesion = trim($data['profesion'] ?? '');
        $descripcion = trim($data['descripcion'] ?? '');

        $stmt = $pdo->prepare("UPDATE docentes SET nombres=?, profesion=?, descripcion=? WHERE id=?");
        $stmt->execute([$nombres, $profesion, $descripcion, $id]);
        echo json_encode(['success' => true, 'message' => 'Docente actualizado']);
        break;

    case 'eliminar':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM docentes WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Docente eliminado']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
