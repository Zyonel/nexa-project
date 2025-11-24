document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login");

  if (!form) {
    console.error("Login form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // ✅ Stop the page from reloading

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Please enter both username and password!");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

const data = await res.json();

if (data.success) {
  alert("Login successful!");
  
  // Store full user data in sessionStorage only
  sessionStorage.setItem("user", JSON.stringify(data.user));
  
  window.location.href = "dashboard.html";
} else {
  alert(" " + data.message);
}

    } catch (err) {
      console.error("⚠️ Error logging in:", err);
      alert("Could not connect to the server. Make sure it's running.");
    }
  });
});
