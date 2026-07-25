<?php
require_once __DIR__ . '/../config.php';

$action = $_GET['action'] ?? 'listar';

// Verificar sesión admin
function verificarAdmin() {
    if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Acceso no autorizado']);
        exit;
    }
}

switch ($action) {

    case 'listar':
        verificarAdmin();
        try {
            // Contar cursos por usuario (excluir password del SELECT)
            $query = "SELECT u.id, u.nombres, u.apellidos, u.email, u.telefono, u.colegiado, u.dni, u.rol, u.created_at,
                             (SELECT COUNT(*) FROM matriculas m WHERE m.usuario_id = u.id) AS total_cursos
                      FROM usuarios u 
                      ORDER BY u.created_at DESC";
            $stmt = $pdo->query($query);
            $usuarios = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $usuarios]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'obtener':
        verificarAdmin();
        $id = intval($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT id, nombres, apellidos, email, telefono, colegiado, dni, rol, created_at FROM usuarios WHERE id = ?");
        $stmt->execute([$id]);
        $usuario = $stmt->fetch();
        if ($usuario) {
            echo json_encode(['success' => true, 'data' => $usuario]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
        }
        break;

    case 'crear':
        verificarAdmin();
        $data = jsonInput();
        $nombres = trim($data['nombres'] ?? '');
        $apellidos = trim($data['apellidos'] ?? '');
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        $telefono = trim($data['telefono'] ?? '');
        $colegiado = trim($data['colegiado'] ?? '') ?: null;
        $dni = trim($data['dni'] ?? '') ?: null;
        $rol = trim($data['rol'] ?? 'usuario');

        if (!$nombres || !$apellidos || !$email || !$password) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Campos obligatorios faltantes']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
        $check->execute([$email]);
        if ($check->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'El correo ya existe']);
            exit;
        }

        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $insert = $pdo->prepare("INSERT INTO usuarios (nombres, apellidos, email, password, telefono, colegiado, dni, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $insert->execute([$nombres, $apellidos, $email, $hashed, $telefono, $colegiado, $dni, $rol]);

        echo json_encode(['success' => true, 'message' => 'Usuario creado exitosamente', 'id' => $pdo->lastInsertId()]);
        break;

    case 'actualizar':
        verificarAdmin();
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }

        $nombres = trim($data['nombres'] ?? '');
        $apellidos = trim($data['apellidos'] ?? '');
        $email = trim($data['email'] ?? '');
        $telefono = trim($data['telefono'] ?? '');
        $colegiado = trim($data['colegiado'] ?? '') ?: null;
        $dni = trim($data['dni'] ?? '') ?: null;
        $rol = trim($data['rol'] ?? 'usuario');

        $sql = "UPDATE usuarios SET nombres=?, apellidos=?, email=?, telefono=?, colegiado=?, dni=?, rol=?";
        $params = [$nombres, $apellidos, $email, $telefono, $colegiado, $dni, $rol];

        if (!empty($data['password'])) {
            $sql .= ", password=?";
            $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        $sql .= " WHERE id=?";
        $params[] = $id;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true, 'message' => 'Usuario actualizado']);
        break;

    case 'eliminar':
        verificarAdmin();
        $data = jsonInput();
        $id = intval($data['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Usuario eliminado']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
