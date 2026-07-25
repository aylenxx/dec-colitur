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
            $stmt = $pdo->query("SELECT clave, valor, descripcion FROM configuracion ORDER BY id");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'guardar':
        $data = jsonInput();
        if (empty($data)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No hay datos para guardar']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)");
            foreach ($data as $clave => $valor) {
                $stmt->execute([$clave, $valor]);
            }
            echo json_encode(['success' => true, 'message' => 'Configuración actualizada']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
