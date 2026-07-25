<?php
require_once __DIR__ . '/../config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Archivo no recibido']);
    exit;
}

$file = $_FILES['archivo'];
$allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

if (!in_array($file['type'], $allowed)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Tipo de archivo no permitido. Use PNG, JPG, WEBP o GIF.']);
    exit;
}

if ($file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El archivo supera 5 MB']);
    exit;
}

$uploadDir = __DIR__ . '/../../uploads/firmas/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$nombre = 'firma_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$filePath = $uploadDir . $nombre;

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    error_log('ERROR: move_uploaded_file falló para firma upload');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al guardar archivo']);
    exit;
}

$relativeUrl = 'uploads/firmas/' . $nombre;
echo json_encode(['success' => true, 'url' => $relativeUrl]);
