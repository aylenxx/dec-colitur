<?php
require_once __DIR__ . '/../config.php';

error_log('=== TRABAJO UPLOAD ===');
error_log('SESSION: ' . json_encode($_SESSION));
error_log('POST: ' . json_encode($_POST));
error_log('FILES: ' . json_encode($_FILES));

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    error_log('ERROR: No autenticado');
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit;
}

$user_id = $_SESSION['user_id'];
$clase_id = intval($_POST['clase_id'] ?? 0);

error_log('user_id: ' . $user_id . ' | clase_id: ' . $clase_id);

if (!$clase_id) {
    echo json_encode(['success' => false, 'message' => 'clase_id es requerido']);
    exit;
}

if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['archivo']['error'] ?? 'no_file';
    error_log('ERROR FILE: code=' . $errCode);
    echo json_encode(['success' => false, 'message' => 'No se recibió ningún archivo (error: ' . $errCode . ')']);
    exit;
}

$file = $_FILES['archivo'];
$originalName = $file['name'];
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowed = ['pdf', 'docx', 'doc'];

error_log('Archivo: ' . $originalName . ' | ext: ' . $ext . ' | size: ' . $file['size']);

if (!in_array($ext, $allowed)) {
    echo json_encode(['success' => false, 'message' => 'Formato no permitido. El formato aceptado es PDF.']);
    exit;
}

if ($file['size'] > 10 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'El archivo supera los 10 MB.']);
    exit;
}

$uploadDir = __DIR__ . '/../../uploads/trabajos/' . $user_id . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName);
$fileName = time() . '_' . $safeName;
$filePath = $uploadDir . $fileName;

error_log('Guardando en: ' . $filePath);

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    error_log('ERROR: move_uploaded_file falló');
    echo json_encode(['success' => false, 'message' => 'Error al guardar el archivo en el servidor.']);
    exit;
}

error_log('Archivo guardado OK');

$relativeUrl = 'uploads/trabajos/' . $user_id . '/' . $fileName;

try {
    $stmt = $pdo->prepare("SELECT id FROM trabajos WHERE usuario_id = ? AND clase_id = ?");
    $stmt->execute([$user_id, $clase_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("UPDATE trabajos SET archivo = ?, fecha = NOW() WHERE id = ?");
        $stmt->execute([$relativeUrl, $existing['id']]);
        error_log('UPDATE trabajos id=' . $existing['id']);
    } else {
        $stmt = $pdo->prepare("INSERT INTO trabajos (usuario_id, clase_id, archivo, fecha) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$user_id, $clase_id, $relativeUrl]);
        error_log('INSERT trabajos OK');
    }

    echo json_encode([
        'success' => true,
        'message' => 'Trabajo subido correctamente',
        'url' => $relativeUrl,
        'nombre' => $originalName
    ]);
} catch (PDOException $e) {
    error_log('ERROR DB: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error en la base de datos: ' . $e->getMessage()]);
}
