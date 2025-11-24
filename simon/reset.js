document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("resetForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

    const res = await fetch("http://localhost:3000/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ Password reset successful! Please log in.");
      window.location.href = "login.html";
    } else {
      alert("❌ " + data.message);
    }
  });
});
