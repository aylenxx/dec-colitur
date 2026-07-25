<?php
require_once __DIR__ . '/config.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit('No autenticado');
}

$file = $_GET['file'] ?? '';
if (!$file) {
    http_response_code(400);
    exit('Archivo no especificado');
}

$file = str_replace('\\', '/', $file);
$file = ltrim($file, '/');

if (strpos($file, 'uploads/trabajos/') !== 0) {
    http_response_code(403);
    exit('Acceso denegado');
}

$basePath = realpath(__DIR__ . '/../uploads/trabajos');
$fullPath = realpath(__DIR__ . '/../' . $file);

if ($fullPath === false || strpos($fullPath, $basePath) !== 0) {
    http_response_code(403);
    exit('Acceso denegado');
}

if (!file_exists($fullPath)) {
    http_response_code(404);
    exit('Archivo no encontrado');
}

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));

$mimeTypes = [
    'pdf'  => 'application/pdf',
    'doc'  => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
];

$mime = $mimeTypes[$ext] ?? 'application/octet-stream';
$filename = basename($fullPath);
$originalName = preg_replace('/^\d+_/', '', $filename);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($fullPath));
header('Content-Disposition: inline; filename="' . $originalName . '"');
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');

readfile($fullPath);
exit;
