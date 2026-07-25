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
        $stmt = $pdo->query("SELECT * FROM categorias ORDER BY nombre");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    case 'crear':
        $data = jsonInput();
        $nombre = trim($data['nombre'] ?? '');
        if (!$nombre) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Nombre requerido']);
            exit;
        }
        $stmt = $pdo->prepare("INSERT INTO categorias (nombre) VALUES (?)");
        $stmt->execute([$nombre]);
        echo json_encode(['success' => true, 'message' => 'Categoría creada', 'id' => $pdo->lastInsertId()]);
        break;

    case 'actualizar':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $nombre = trim($data['nombre'] ?? '');
        $stmt = $pdo->prepare("UPDATE categorias SET nombre=? WHERE id=?");
        $stmt->execute([$nombre, $id]);
        echo json_encode(['success' => true, 'message' => 'Categoría actualizada']);
        break;

    case 'eliminar':
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM categorias WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Categoría eliminada']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
