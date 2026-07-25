<?php
require_once __DIR__ . '/../config.php';

$tipo = $_GET['tipo'] ?? 'publico';

try {
    if ($tipo === 'cursos') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) { echo json_encode(['success' => false, 'message' => 'ID requerido']); exit; }
        $stmt = $pdo->prepare("SELECT c.*, cat.nombre AS categoria_nombre, d.nombres AS docente_nombre, d.profesion AS docente_profesion, d.descripcion AS docente_descripcion, d.foto AS docente_foto,
                               (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id) AS matriculados
                               FROM cursos c
                               LEFT JOIN categorias cat ON c.categoria_id = cat.id
                               LEFT JOIN docentes d ON c.docente_id = d.id
                               WHERE c.id = ?");
        $stmt->execute([$id]);
        $curso = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($curso) {
            echo json_encode(['success' => true, 'data' => $curso]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Curso no encontrado']);
        }
        exit;
    }

    if ($tipo === 'modulos') {
        $curso_id = intval($_GET['curso_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM modulos WHERE curso_id = ? ORDER BY orden");
        $stmt->execute([$curso_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($tipo === 'clases') {
        $modulo_id = intval($_GET['modulo_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM clases WHERE modulo_id = ? ORDER BY orden");
        $stmt->execute([$modulo_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($tipo === 'admin') {
        $query = "SELECT c.*, cat.nombre AS categoria_nombre, d.nombres AS docente_nombre, d.profesion AS docente_profesion,
                         (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id) AS total_matriculas,
                         (SELECT COUNT(*) FROM clases cl JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = c.id) AS total_clases
                  FROM cursos c
                  LEFT JOIN categorias cat ON c.categoria_id = cat.id
                  LEFT JOIN docentes d ON c.docente_id = d.id
                  ORDER BY c.id DESC";
    } else {
        $query = "SELECT c.*, cat.nombre AS categoria_nombre, d.nombres AS docente_nombre, d.profesion AS docente_profesion,
                         (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id) AS total_matriculas,
                         (SELECT COUNT(*) FROM clases cl JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = c.id) AS total_clases
                  FROM cursos c
                  LEFT JOIN categorias cat ON c.categoria_id = cat.id
                  LEFT JOIN docentes d ON c.docente_id = d.id
                  WHERE c.estado = 'Publicado'
                  ORDER BY c.id DESC";
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute();
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
