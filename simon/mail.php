<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $name = $_POST['name'];
  $email = $_POST['email'];
  $tel = $_POST['tel'];
  $message = $_POST['message'];

  $to = "xeeonairexeeboy@gmail.com";
  $subject = "New Message from $name";
  $body = "Name: $name\nEmail: $email\nTel: $tel\nMessage: $message";
  $headers = "From: $email\r\nReply-To: $email\r\n";

  if (mail($to, $subject, $body, $headers)) {
    echo "success";
  } else {
    echo "error";
  }
}
?>
