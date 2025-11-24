document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(sessionStorage.getItem("user"));
  if (!user) {
    alert("Not logged in");
    window.location.href = "login.html";
    return;
  }

  // Load existing data
  document.getElementById("fullname").value = user.fullname || "";
  document.getElementById("newUsername").value = user.username || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("country").value = user.country || "";
  document.getElementById("phone").value = user.phone || "";

  // Load existing profile pic
  if (user.profile_pic) {
    document.getElementById("previewPic").src = "http://localhost:3000" + user.profile_pic;
  }

  // Live image preview
  document.getElementById("profilePic").addEventListener("change", function () {
    if (this.files && this.files[0]) {
      document.getElementById("previewPic").src = URL.createObjectURL(this.files[0]);
    }
  });

  // Submit form
  document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("username", user.username);
    formData.append("fullname", document.getElementById("fullname").value);
    formData.append("newUsername", document.getElementById("newUsername").value);
    formData.append("email", document.getElementById("email").value);
    formData.append("country", document.getElementById("country").value);
    formData.append("phone", document.getElementById("phone").value);

   /* const password = document.getElementById("password").value;
    if (password.trim() !== "") formData.append("password", password);
*/
    const pic = document.getElementById("profilePic").files[0];
    if (pic) formData.append("profile_pic", pic);

    try {
      const res = await fetch("http://localhost:3000/api/user/edit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
console.log("SERVER RESPONSE:", data);

      if (data.success) {
        alert("Profile updated!");

        // Save updated user in sessionStorage
        sessionStorage.setItem("user", JSON.stringify(data.user));

        window.location.href = "profile.html";
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  });
});
