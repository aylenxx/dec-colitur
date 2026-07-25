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
    $stmt = $pdo->prepare("
        SELECT c.*, cat.nombre AS categoria_nombre, d.nombres AS docente_nombre,
               m.fecha AS fecha_matricula, m.estado AS matricula_estado
        FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        LEFT JOIN categorias cat ON c.categoria_id = cat.id
        LEFT JOIN docentes d ON c.docente_id = d.id
        WHERE m.usuario_id = ?
        ORDER BY m.fecha DESC
    ");
    $stmt->execute([$user_id]);
    $cursos = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $cursos
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
