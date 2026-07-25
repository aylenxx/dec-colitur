<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

$action = $_GET['action'] ?? 'listar';

function verificarAdmin() {
    if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Acceso no autorizado']);
        exit;
    }
}

switch ($action) {

    case 'listar':
        try {
            $query = "SELECT c.id, c.curso_id, c.firma1_nombre, c.firma1_cargo, c.firma1_imagen, c.firma2_nombre, c.firma2_cargo, c.firma2_imagen, c.firma3_nombre, c.firma3_cargo, c.firma3_imagen, c.created_at,
                             co.titulo AS curso_titulo,
                             (SELECT COUNT(*) FROM certificados_emitidos ce WHERE ce.certificado_id = c.id) AS emitidos
                      FROM certificados c
                      LEFT JOIN cursos co ON c.curso_id = co.id
                      ORDER BY c.created_at DESC";
            $stmt = $pdo->query($query);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'listar_estudiantes':
        try {
            $query = "SELECT DISTINCT u.id, u.nombres, u.apellidos, u.dni, u.email, u.colegiado,
                             m.curso_id,
                             co.titulo AS curso_titulo,
                             (SELECT COUNT(*) FROM clases cl2 JOIN modulos mo2 ON cl2.modulo_id = mo2.id WHERE mo2.curso_id = m.curso_id) AS total_clases,
                             (SELECT COUNT(*) FROM avance_clase av2 JOIN clases cl3 ON av2.clase_id = cl3.id JOIN modulos mo3 ON cl3.modulo_id = mo3.id WHERE mo3.curso_id = m.curso_id AND av2.usuario_id = m.usuario_id AND av2.completada = 1) AS clases_completadas
                      FROM matriculas m
                      JOIN usuarios u ON m.usuario_id = u.id
                      JOIN cursos co ON m.curso_id = co.id
                      ORDER BY u.apellidos, u.nombres";
            $stmt = $pdo->query($query);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'listar_cursos':
        try {
            $stmt = $pdo->query("SELECT id, titulo, horas_duracion FROM cursos WHERE estado IN ('published','Publicado') ORDER BY titulo");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'listar_elegibles':
        try {
            $curso_id = intval($_GET['curso_id'] ?? 0);
            if (!$curso_id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'curso_id requerido']);
                exit;
            }
            $query = "SELECT u.id, u.nombres, u.apellidos, u.dni, u.email,
                             m.curso_id,
                             (SELECT COUNT(*) FROM clases cl2 JOIN modulos mo2 ON cl2.modulo_id = mo2.id WHERE mo2.curso_id = m.curso_id) AS total_clases,
                             (SELECT COUNT(*) FROM avance_clase av2 JOIN clases cl3 ON av2.clase_id = cl3.id JOIN modulos mo3 ON cl3.modulo_id = mo3.id WHERE mo3.curso_id = m.curso_id AND av2.usuario_id = m.usuario_id AND av2.completada = 1) AS clases_completadas,
                             (SELECT COUNT(*) FROM clases trab JOIN modulos moT ON trab.modulo_id = moT.id WHERE moT.curso_id = m.curso_id AND trab.tipo_contenido = 'trabajo') AS total_trabajos,
                             (SELECT COUNT(*) FROM trabajos t JOIN clases clT ON t.clase_id = clT.id JOIN modulos moT ON clT.modulo_id = moT.id WHERE moT.curso_id = m.curso_id AND t.usuario_id = m.usuario_id AND t.calificacion IS NOT NULL) AS trabajos_calificados
                      FROM matriculas m
                      JOIN usuarios u ON m.usuario_id = u.id
                      WHERE m.curso_id = ? AND u.rol = 'usuario'
                      ORDER BY u.apellidos, u.nombres";
            $stmt = $pdo->prepare($query);
            $stmt->execute([$curso_id]);
            $estudiantes = $stmt->fetchAll();

            $elegibles = [];
            foreach ($estudiantes as $e) {
                $total = intval($e['total_clases']);
                $completadas = intval($e['clases_completadas']);
                $totalTrabajos = intval($e['total_trabajos']);
                $trabajosCalificados = intval($e['trabajos_calificados']);
                $pct = $total > 0 ? round(($completadas / $total) * 100) : 0;
                $allWorksGraded = ($totalTrabajos === 0) || ($trabajosCalificados >= $totalTrabajos);

                if ($pct >= 100 && $allWorksGraded) {
                    $e['porcentaje'] = $pct;
                    $elegibles[] = $e;
                }
            }

            $stmt2 = $pdo->prepare("SELECT ce.usuario_id FROM certificados_emitidos ce WHERE ce.curso_id = ?");
            $stmt2->execute([$curso_id]);
            $yaEnviados = array_column($stmt2->fetchAll(), 'usuario_id');

            $pendientes = array_filter($elegibles, function($e) use ($yaEnviados) {
                return !in_array($e['id'], $yaEnviados);
            });

            echo json_encode([
                'success' => true,
                'data' => array_values($pendientes),
                'total_elegibles' => count($elegibles),
                'ya_enviados' => count($yaEnviados)
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'registrar_descarga':
        verificarAdmin();
        $data = jsonInput();
        $emitido_id = intval($data['id'] ?? 0);
        if (!$emitido_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE certificados_emitidos SET fecha_descarga = NOW() WHERE id = ?");
        $stmt->execute([$emitido_id]);
        echo json_encode(['success' => true, 'message' => 'Descarga registrada']);
        break;

    case 'crear':
        verificarAdmin();
        $data = jsonInput();
        $curso_id = intval($data['curso_id'] ?? 0);
        $firma1_nombre = trim($data['firma1_nombre'] ?? '');
        $firma1_cargo = trim($data['firma1_cargo'] ?? '');
        $firma1_imagen = trim($data['firma1_imagen'] ?? '');
        $firma2_nombre = trim($data['firma2_nombre'] ?? '');
        $firma2_cargo = trim($data['firma2_cargo'] ?? '');
        $firma2_imagen = trim($data['firma2_imagen'] ?? '');
        $firma3_nombre = trim($data['firma3_nombre'] ?? '');
        $firma3_cargo = trim($data['firma3_cargo'] ?? '');
        $firma3_imagen = trim($data['firma3_imagen'] ?? '');

        if (!$curso_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Curso es obligatorio']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO certificados (curso_id, firma1_nombre, firma1_cargo, firma1_imagen, firma2_nombre, firma2_cargo, firma2_imagen, firma3_nombre, firma3_cargo, firma3_imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$curso_id, $firma1_nombre, $firma1_cargo, $firma1_imagen, $firma2_nombre, $firma2_cargo, $firma2_imagen, $firma3_nombre, $firma3_cargo, $firma3_imagen]);
        echo json_encode(['success' => true, 'message' => 'Certificado creado', 'id' => $pdo->lastInsertId()]);
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
        $curso_id = intval($data['curso_id'] ?? 0);
        $firma1_nombre = trim($data['firma1_nombre'] ?? '');
        $firma1_cargo = trim($data['firma1_cargo'] ?? '');
        $firma1_imagen = trim($data['firma1_imagen'] ?? '');
        $firma2_nombre = trim($data['firma2_nombre'] ?? '');
        $firma2_cargo = trim($data['firma2_cargo'] ?? '');
        $firma2_imagen = trim($data['firma2_imagen'] ?? '');
        $firma3_nombre = trim($data['firma3_nombre'] ?? '');
        $firma3_cargo = trim($data['firma3_cargo'] ?? '');
        $firma3_imagen = trim($data['firma3_imagen'] ?? '');
        $stmt = $pdo->prepare("UPDATE certificados SET curso_id=?, firma1_nombre=?, firma1_cargo=?, firma1_imagen=?, firma2_nombre=?, firma2_cargo=?, firma2_imagen=?, firma3_nombre=?, firma3_cargo=?, firma3_imagen=? WHERE id=?");
        $stmt->execute([$curso_id, $firma1_nombre, $firma1_cargo, $firma1_imagen, $firma2_nombre, $firma2_cargo, $firma2_imagen, $firma3_nombre, $firma3_cargo, $firma3_imagen, $id]);
        echo json_encode(['success' => true, 'message' => 'Certificado actualizado']);
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
        $stmt = $pdo->prepare("DELETE FROM certificados WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Certificado eliminado']);
        break;

    case 'registrar_emision':
        verificarAdmin();
        $data = jsonInput();
        $certificado_id = intval($data['certificado_id'] ?? 0);
        $usuario_id = intval($data['usuario_id'] ?? 0);
        $curso_id = intval($data['curso_id'] ?? 0);

        if (!$usuario_id || !$curso_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
            exit;
        }

        $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM clases cl JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = ?");
        $stmtTotal->execute([$curso_id]);
        $totalClases = $stmtTotal->fetchColumn();

        $stmtComp = $pdo->prepare("SELECT COUNT(*) FROM avance_clase ac JOIN clases cl ON ac.clase_id = cl.id JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = ? AND ac.usuario_id = ? AND ac.completada = 1");
        $stmtComp->execute([$curso_id, $usuario_id]);
        $clasesCompletadas = $stmtComp->fetchColumn();

        if ($totalClases > 0 && $clasesCompletadas < $totalClases) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "El estudiante no ha completado el curso. Progreso: $clasesCompletadas/$totalClases"]);
            exit;
        }

        $stmtTrab = $pdo->prepare("SELECT COUNT(*) FROM trabajos t JOIN clases cl ON t.clase_id = cl.id JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = ? AND t.usuario_id = ? AND cl.tipo_contenido = 'trabajo'");
        $stmtTrab->execute([$curso_id, $usuario_id]);
        $trabajosEnviados = $stmtTrab->fetchColumn();

        $stmtTrabCal = $pdo->prepare("SELECT COUNT(*) FROM trabajos t JOIN clases cl ON t.clase_id = cl.id JOIN modulos mo ON cl.modulo_id = mo.id WHERE mo.curso_id = ? AND t.usuario_id = ? AND cl.tipo_contenido = 'trabajo' AND t.calificacion IS NOT NULL");
        $stmtTrabCal->execute([$curso_id, $usuario_id]);
        $trabajosCalificados = $stmtTrabCal->fetchColumn();

        if ($trabajosEnviados > 0 && $trabajosCalificados < $trabajosEnviados) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "No todos los trabajos han sido calificados. Calificados: $trabajosCalificados/$trabajosEnviados"]);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO certificados_emitidos (certificado_id, usuario_id, curso_id, fecha_emision) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$certificado_id, $usuario_id, $curso_id]);

        $emailEnviado = false;
        $stmtUser = $pdo->prepare("SELECT nombres, apellidos, email FROM usuarios WHERE id = ?");
        $stmtUser->execute([$usuario_id]);
        $user = $stmtUser->fetch();
        $stmtCurso = $pdo->prepare("SELECT titulo FROM cursos WHERE id = ?");
        $stmtCurso->execute([$curso_id]);
        $curso = $stmtCurso->fetch();

        if ($user && $user['email'] && $curso) {
            require_once __DIR__ . '/../mailer.php';
            $nombreEstudiante = $user['nombres'] . ' ' . $user['apellidos'];
            $tituloCurso = $curso['titulo'];
            $asunto = "DEC COLITUR - Certificado de Finalización: {$tituloCurso}";
            $html = "
                <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>
                    <div style='background:#1A1A2E;color:#fff;padding:24px 30px;border-radius:12px 12px 0 0'>
                        <h1 style='margin:0;font-size:22px'>🎓 DEC COLITUR</h1>
                        <p style='margin:6px 0 0;font-size:14px;opacity:.85'>Certificado de Finalización</p>
                    </div>
                    <div style='background:#f8f9fa;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px'>
                        <p style='font-size:15px;color:#333'>Estimado/a <strong>{$nombreEstudiante}</strong>,</p>
                        <p style='font-size:14px;color:#555;line-height:1.6'>
                            Felicitaciones. Has completado exitosamente el curso <strong>«{$tituloCurso}»</strong> otorgado por la Decana de Estudios Contables de la Universidad Nacional de Educación – ENAD.
                        </p>
                        <p style='font-size:14px;color:#555;line-height:1.6'>
                            Tu certificado ya está disponible en tu dashboard. Puede descargarlo desde la sección <strong>«Mis Certificados»</strong>.
                        </p>
                        <div style='text-align:center;margin:24px 0'>
                            <a href='" . FRONTEND_URL . "/mis_certificados' style='display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px'>Ver mi certificado</a>
                        </div>
                        <p style='font-size:12px;color:#999;margin-top:20px;text-align:center'>
                            DEC COLITUR — Decana de Estudios Contables<br>Universidad Nacional de Educación – ENAD
                        </p>
                    </div>
                </div>";
            $emailEnviado = enviarCorreo($user['email'], $asunto, $html);
        }

        echo json_encode([
            'success' => true,
            'message' => $emailEnviado ? 'Certificado enviado por correo' : 'Emisión registrada (no se pudo enviar el correo)',
            'email_enviado' => $emailEnviado
        ]);
        break;

    case 'listar_emisiones':
        try {
            $query = "SELECT ce.id, ce.fecha_emision, ce.fecha_descarga,
                             u.id AS usuario_id, u.nombres, u.apellidos, u.dni, u.email,
                             co.id AS curso_id, co.titulo AS curso_titulo
                      FROM certificados_emitidos ce
                      JOIN usuarios u ON ce.usuario_id = u.id
                      JOIN cursos co ON ce.curso_id = co.id
                      ORDER BY ce.fecha_emision DESC
                      LIMIT 50";
            $stmt = $pdo->query($query);
            $emisiones = $stmt->fetchAll();

            $statsQuery = "SELECT
                COUNT(*) AS total_emitidos,
                SUM(CASE WHEN fecha_descarga IS NOT NULL THEN 1 ELSE 0 END) AS descargados,
                SUM(CASE WHEN fecha_descarga IS NULL THEN 1 ELSE 0 END) AS pendientes
              FROM certificados_emitidos";
            $statsStmt = $pdo->query($statsQuery);
            $stats = $statsStmt->fetch();

            echo json_encode([
                'success' => true,
                'data' => $emisiones,
                'stats' => [
                    'emitidos' => intval($stats['total_emitidos'] ?? 0),
                    'descargados' => intval($stats['descargados'] ?? 0),
                    'pendientes' => intval($stats['pendientes'] ?? 0),
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Acción no válida']);
}
