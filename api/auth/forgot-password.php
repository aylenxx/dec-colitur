<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../mailer.php';

$data  = jsonInput();
$email = trim($data['email'] ?? '');

if (!$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El correo es requerido']);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = ?');
$stmt->execute([$email]);
$usuario = $stmt->fetch();

// Igual que antes: siempre respondemos OK aunque el correo no exista,
// para no revelar qué correos están registrados.
if (!$usuario) {
    echo json_encode(['success' => true, 'message' => 'Si el correo existe, recibirás un enlace']);
    exit;
}

// Invalidar tokens anteriores de este usuario
$pdo->prepare('UPDATE password_reset_tokens SET used = 1 WHERE email = ?')->execute([$email]);

// random_bytes() es el equivalente nativo de PHP a crypto.randomBytes()
$resetToken = bin2hex(random_bytes(40));
$expiresAt  = date('Y-m-d H:i:s', time() + 60 * 60); // 60 minutos

$insert = $pdo->prepare(
    'INSERT INTO password_reset_tokens (email, token, expires_at, used, created_at)
     VALUES (?, ?, ?, 0, NOW())'
);
$insert->execute([$email, $resetToken, $expiresAt]);

$resetUrl = FRONTEND_URL . "/index.html?token={$resetToken}&mode=reset";

$html = "
    <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;\">
        <h2 style=\"color: #1a365d; text-align: center;\">Recuperación de Contraseña</h2>
        <p>Hola,</p>
        <p>Has solicitado restablecer tu contraseña para tu cuenta en <strong>DEC COLITUR</strong>.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <div style=\"text-align: center; margin: 30px 0;\">
            <a href=\"{$resetUrl}\" style=\"background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;\">Restablecer Contraseña</a>
        </div>
        <p style=\"font-size: 14px; color: #666;\">Este enlace expira en <strong>60 minutos</strong> y solo puede usarse una vez.</p>
        <p style=\"font-size: 14px; color: #666;\">Si no solicitaste este cambio, ignora este correo.</p>
        <hr style=\"margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;\">
        <p style=\"font-size: 12px; color: #999; text-align: center;\">
            Si el botón no funciona, copia y pega este enlace:<br>
            <a href=\"{$resetUrl}\" style=\"color: #1a365d;\">{$resetUrl}</a>
        </p>
    </div>
";

$enviado = enviarCorreo($email, '🔐 Recuperación de Contraseña - DEC COLITUR', $html);

if (!$enviado) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error enviando correo']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Enlace enviado al correo']);
