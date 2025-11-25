document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(sessionStorage.getItem("user"));

  if (!user) {
    alert("Please log in first.");
    window.location.href = "login.html";
    return;
  }

  // Pre-fill the form
  document.getElementById("fullname").value = user.fullname || "";
  document.getElementById("username").value = user.username || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("country").value = user.country || "";

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  // Save profile changes
  const profileForm = document.getElementById("profileForm");
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const updatedData = {
      fullname: document.getElementById("fullname").value.trim(),
      email: document.getElementById("email").value.trim(),
      country: document.getElementById("country").value.trim(),
    };

    try {
      const res = await fetch(`https://nexa-project-l5pg.onrender.com/api/user/${user.username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Profile updated successfully!");
        // Update sessionStorage
        sessionStorage.setItem("user", JSON.stringify({ ...user, ...updatedData }));
      } else {
        alert("⚠️ " + data.message);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("⚠️ Could not connect to server.");
    }
  });
});
