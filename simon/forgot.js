document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();

    const res = await fetch("https://nexa-project-l5pg.onrender.com/api/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (data.success) {
      alert(" Reset code generated: " + data.code);
      window.location.href = "reset.html";
    } else {
      alert(" " + data.message);
    }
  });
});
