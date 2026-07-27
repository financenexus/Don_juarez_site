<?php
declare(strict_types=1);

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");

function respond(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(["message" => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
    header("Allow: POST");
    respond(405, "Método não permitido.");
}

$contentType = $_SERVER["CONTENT_TYPE"] ?? "";
if (stripos($contentType, "application/json") !== 0) {
    respond(415, "Envie os dados em formato JSON.");
}

$data = json_decode((string) file_get_contents("php://input"), true);
if (!is_array($data)) {
    respond(400, "Dados inválidos.");
}

$name = trim(strip_tags((string) ($data["name"] ?? "")));
$contact = trim(strip_tags((string) ($data["contact"] ?? "")));
$message = trim(strip_tags((string) ($data["message"] ?? "")));

if ($name === "" || $contact === "" || $message === "") {
    respond(400, "Por favor, preencha todos os campos.");
}

if (strlen($name) > 120 || strlen($contact) > 160 || strlen($message) > 5000) {
    respond(400, "Um ou mais campos excedem o tamanho permitido.");
}

if (preg_match('/[\r\n]/', $contact)) {
    respond(400, "Contato inválido.");
}

$to = "contato@tabacodonjuarez.com.br";
$subject = "Nova Mensagem de Contato: " . $name;
$emailContent = "Nome: {$name}\nContato: {$contact}\n\nMensagem:\n{$message}\n";
$headers = [
    "From: Don Juarez Site <contato@tabacodonjuarez.com.br>",
    "Content-Type: text/plain; charset=UTF-8",
];

if (filter_var($contact, FILTER_VALIDATE_EMAIL)) {
    $headers[] = "Reply-To: " . $contact;
}

if (!mail($to, $subject, $emailContent, implode("\r\n", $headers))) {
    respond(500, "Erro ao enviar mensagem. Tente novamente.");
}

respond(200, "Mensagem enviada com sucesso!");
