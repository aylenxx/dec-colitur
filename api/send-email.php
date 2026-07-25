<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

$data = jsonInput();

$nombre  = trim($data['nombre'] ?? '');
$email   = trim($data['email'] ?? '');
$asunto  = trim($data['asunto'] ?? '');
$mensaje = trim($data['mensaje'] ?? '');

if (!$nombre || !$email || !$mensaje) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nombre, email y mensaje son requeridos']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email no válido']);
    exit;
}

$fecha = date('d/m/Y H:i');

$html = "
    <div style=\"font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;\">
        <h2 style=\"color: #1a365d; text-align: center;\">📧 Nuevo Mensaje de Contacto</h2>
        <p><strong>Nombre:</strong> {$nombre}</p>
        <p><strong>Email:</strong> {$email}</p>
        <p><strong>Asunto:</strong> " . ($asunto ?: 'No especificado') . "</p>
        <hr style=\"margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;\">
        <p style=\"white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 6px;\">{$mensaje}</p>
        <hr style=\"margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;\">
        <p style=\"font-size: 12px; color: #999; text-align: center;\">
            Este mensaje fue enviado desde el formulario de contacto de DEC COLITUR<br>
            Fecha: {$fecha}
        </p>
    </div>
";

$enviado = enviarCorreo(
    MAIL_USER,
    '📧 Formulario DEC COLITUR: ' . ($asunto ?: 'Sin asunto') . " - De: {$nombre}",
    $html,
    $email // replyTo
);

if (!$enviado) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno al enviar el mensaje']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Mensaje enviado correctamente']);
