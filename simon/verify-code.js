/*****************************************************
 * VERIFY-CODE.JS
 * Features:
 *  - Verify Access Code
 *  - Signup new user
 *  - Referral system (auto-detect or manual input)
 *  - Auto-login & redirect to personalized dashboard
 *****************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  // ✅ Get referral username from URL (if user registered through ref link)
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref"); // Example: ?ref=Peace

  if (ref) {
    const refInput = document.getElementById("referralInput");
    if (refInput) {
      refInput.value = ref;
      refInput.readOnly = true; // prevent editing if referral came from link
    }
  }

  // ✅ FORM SUBMIT HANDLER
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop default page reload

    const code = document.getElementById("otpInput").value.trim();

    if (!code) {
      alert(" Please enter an access key!");
      return;
    }

    try {
      /*****************************************************
       * STEP 1: VERIFY ACCESS CODE
       *****************************************************/
      const verifyRes = await fetch("https://nexa-project-l5pg.onrender.com/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        if (verifyData.reason === "expired") return alert("Access key expired!");
        if (verifyData.reason === "already_used") return alert("Access key already used!");
        return alert(" Invalid access key!");
      }

      alert("Access key verified!");

      /*****************************************************
       * STEP 2: COLLECT USER FORM DATA
       *****************************************************/
      const formData = new FormData(form);
      const user = Object.fromEntries(formData.entries());
      user.code = code;
      // 🛠 Ensure we only send the username, not the full URL
let referralValue = ref || document.getElementById("referralInput").value.trim();
if (referralValue && referralValue.includes("?ref=")) {
  try {
    const url = new URL(referralValue);
    referralValue = url.searchParams.get("ref") || referralValue;
  } catch (e) {
    // fallback: remove common patterns if user pasted full link
    referralValue = referralValue.split("ref=").pop();
  }
}
user.ref = referralValue.replace(/^https?:\/\/[^/]+\/(register|sign-up)\.html\?ref=/, "").trim();

      /*****************************************************
       * STEP 3: REGISTER USER
       *****************************************************/
      const signupRes = await fetch("https://nexa-project-l5pg.onrender.com/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      const signupData = await signupRes.json();

      if (signupData.success) {
        alert("Signup successful! Redirecting to your dashboard...");

        // ✅ Save new user data locally for personalized dashboard
        const savedUser = {
          fullname: user.fullname,
          username: user.username,
          email: user.email,
          country: user.country,
        };

        sessionStorage.setItem("user", JSON.stringify(savedUser));

// ✅ Redirect to personalized dashboard
window.location.href = "dashboard.html";

      } else {
        alert(" " + signupData.message);
      }
    } catch (err) {
      console.error("Error verifying or signing up:", err);
      alert(" Could not connect to the server. Make sure the backend is running!");
    }
  });
});
