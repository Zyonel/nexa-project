/*****************************************************
 * 🧩 ADMIN PANEL SCRIPT (FINAL VERSION)
 *****************************************************/

// 🔐 Admin password handling
let ADMIN_PASS = localStorage.getItem("adminPass");

async function verifyAdminPassword() {
  while (true) {
    if (!ADMIN_PASS) {
      ADMIN_PASS = prompt("Enter admin password:");
      if (!ADMIN_PASS) {
        alert("Access denied — password required.");
        window.location.href = "/";
        return false;
      }
    }

    try {
      const res = await fetch("https://nexa-project-l5pg.onrender.com/api/admin/withdrawals", {
        headers: { "x-admin-pass": ADMIN_PASS },
      });

      if (res.status === 401) {
        alert("❌ Incorrect password.");
        localStorage.removeItem("adminPass");
        ADMIN_PASS = null;
        continue; // re-prompt
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      localStorage.setItem("adminPass", ADMIN_PASS);
      console.log("✅ Admin authenticated");
      return true;
    } catch (err) {
      console.error("Password verification failed:", err);
      alert("Server unreachable or internal error.");
      return false;
    }
  }
}

// 🧾 Code generator
async function generateCode() {
  try {
    const length = parseInt(document.getElementById("length").value) || 6;
    const res = await fetch("https://nexa-project-l5pg.onrender.com/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-pass": ADMIN_PASS,
      },
      body: JSON.stringify({ length }),
    });

    if (!res.ok) throw new Error("Server error while generating code");
    const data = await res.json();
    if (!data.code) throw new Error(data.message || "Failed to generate code");

    const expires = new Date(data.expiresAt).toLocaleString();
    document.getElementById("result").innerHTML = `✅ <b>${data.code}</b> (expires: ${expires})`;

    loadCodes();
  } catch (err) {
    console.error("Generate code error:", err);
    alert("Failed to generate code. Check admin password or server connection.");
  }
}

// Load generated codes
async function loadCodes() {
  try {
    const res = await fetch("https://nexa-project-l5pg.onrender.com/api/list", { headers: { "x-admin-pass": ADMIN_PASS } });
    const codes = await res.json();
    const container = document.getElementById("codeList");

    if (!container) return;
    if (!codes.length) {
      container.innerHTML = "No codes yet.";
      return;
    }

    container.innerHTML = codes
      .map(
        (c) => `
        <div class="flex justify-between items-center border-b py-1">
          <span>${c.code}</span>
          <span class="text-xs ${
            c.used
              ? "text-red-500"
              : Date.now() > c.expires_at
              ? "text-gray-400"
              : "text-green-600"
          }">
            ${
              c.used
                ? "Used"
                : Date.now() > c.expires_at
                ? "Expired"
                : "Active"
            }
          </span>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error("Error loading codes:", err);
  }
}

async function cleanup() {
  await fetch("https://nexa-project-l5pg.onrender.com/api/cleanup", {
    method: "DELETE",
    headers: { "x-admin-pass": ADMIN_PASS },
  });
  loadCodes();
}

// 💸 Withdrawals Management
async function loadWithdrawals(status = "") {
  try {
    const url = status ? `/api/admin/withdrawals?status=${status}` : "/api/admin/withdrawals";
    const res = await fetch(url, { headers: { "x-admin-pass": ADMIN_PASS } });
    const payload = await res.json();

    const tbody = document.querySelector("#withdrawBody");
    const emptyBox = document.getElementById("withdrawEmpty");
    if (!tbody) return;

    if (!payload || !payload.withdrawals || payload.withdrawals.length === 0) {
      tbody.innerHTML = "";
      if (emptyBox) emptyBox.style.display = "block";
      return;
    }

    if (emptyBox) emptyBox.style.display = "none";

    tbody.innerHTML = payload.withdrawals
      .map((w) => {
        const dt = new Date(w.requested_at);
        const statusClass =
          w.status === "approved"
            ? "badge approved"
            : w.status === "rejected"
            ? "badge rejected"
            : "badge pending";

        return `
          <tr>
            <td>${escapeHtml(w.username)}</td>
            <td>₦${Number(w.amount).toFixed(2)}</td>
            <td>${escapeHtml(w.bank_name || "")}</td>
            <td>${escapeHtml(w.account_number || "")}</td>
            <td><span class="${statusClass}">${escapeHtml(w.status)}</span></td>
            <td>${dt.toLocaleString()}</td>
            <td>
              ${
                w.status === "pending"
                  ? `
                    <button class="action-btn approve" data-id="${w.id}">Approve</button>
                    <button class="action-btn reject" data-id="${w.id}">Reject</button>
                  `
                  : `<span class="text-gray-400">—</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".approve").forEach((btn) =>
      btn.addEventListener("click", () => updateWithdrawal(btn.dataset.id, "approved"))
    );
    tbody.querySelectorAll(".reject").forEach((btn) =>
      btn.addEventListener("click", () => updateWithdrawal(btn.dataset.id, "rejected"))
    );
  } catch (err) {
    console.error("Failed to load withdrawals:", err);
  }
}

async function updateWithdrawal(id, status) {
  if (!confirm(`Are you sure you want to mark request #${id} as ${status}?`)) return;

  try {
    const res = await fetch("https://nexa-project-l5pg.onrender.com/api/admin/withdrawals/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-pass": ADMIN_PASS,
      },
      body: JSON.stringify({ id: Number(id), status }),
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message || "Updated successfully!");
      loadWithdrawals();
    } else {
      alert("Error: " + (data.message || "Could not update"));
    }
  } catch (err) {
    console.error("Error updating withdrawal:", err);
    alert("Network error while updating withdrawal.");
  }
}

// Helper: prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Run after verification
verifyAdminPassword().then((ok) => {
  if (!ok) return;

  document.getElementById("adminPanel").classList.remove("hidden");
  document.getElementById("withdrawals").classList.remove("hidden");

  document.getElementById("generateBtn")?.addEventListener("click", generateCode);
  document.getElementById("cleanupBtn")?.addEventListener("click", cleanup);

  document.getElementById("filterAll")?.addEventListener("click", () => loadWithdrawals());
  document.getElementById("filterPending")?.addEventListener("click", () => loadWithdrawals("pending"));
  document.getElementById("filterApproved")?.addEventListener("click", () => loadWithdrawals("approved"));
  document.getElementById("filterRejected")?.addEventListener("click", () => loadWithdrawals("rejected"));

  loadCodes();
  loadWithdrawals();

  // Articles
 /* const articleForm = document.getElementById("articleForm");
  if (articleForm) {
    articleForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData();
      formData.append("title", document.getElementById("title").value);
      formData.append("content", document.getElementById("content").value);

      const img = document.getElementById("image").files[0];
      if (img) formData.append("image", img);

      const res = await fetch("http://localhost:3000/api/articles/add", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        alert("Article posted!");
        window.location.reload();
      } else {
        alert(data.message);
      }*
    });
  }*/

    const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const imageInput = document.getElementById("image"); // type="file"

/*document.getElementById("submitBtn").addEventListener("click", async () => {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const imageFile = imageInput.files[0]; // may be undefined

  const result = await addArticle(title, content, imageFile);

  if (result.success) {
    alert("Article posted successfully!");
  } else {
    alert("Error: " + result.message);
  }
});
*/
});


// =======================
// 🎬 ADD VIDEO
// =======================
// 🎬 ADD VIDEO (supports file upload)
document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("videoTitle").value.trim();
  const reward = Number(document.getElementById("videoReward").value);
  const redirect = document.getElementById("videoRedirect").value.trim();
  const file = document.getElementById("videoFile").files[0];
  const ADMIN_PASS = localStorage.getItem("adminPass");

  if (!title || !file || !reward) {
    return alert("Please fill all fields and select a video file.");
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("reward", reward);
  formData.append("redirect", redirect);   // ✅ FIX ADDED
  formData.append("video", file);

  const res = await fetch("https://nexa-project-l5pg.onrender.com/api/admin/videos", {
    method: "POST",
    headers: { "x-admin-pass": ADMIN_PASS },
    body: formData,
  });

  const data = await res.json();
  alert(data.message || (data.success ? "✅ Video uploaded!" : "❌ Error uploading video"));
});



// =======================
// 📝 ADD TASK
// =======================
document.getElementById("addTaskBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const reward = Number(document.getElementById("taskReward").value);
  const redirect = document.getElementById("taskRedirect").value.trim();
  const ADMIN_PASS = localStorage.getItem("adminPass");

  if (!title || typeof reward === "undefined") {
    return alert("Please provide title and reward");
  }

  const res = await fetch("https://nexa-project-l5pg.onrender.com/api/admin/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-pass": ADMIN_PASS
    },
    body: JSON.stringify({ title, description, reward, redirect })
  });

  const data = await res.json();
  if (data && data.success) {
    alert("Task added!");
    // clear inputs
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDescription").value = "";
    document.getElementById("taskReward").value = "";
    document.getElementById("taskRedirect").value = "";
  } else {
    alert(data.message || "Error adding task");
  }
});

document.getElementById("articleForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;
  const image = document.getElementById("image").files[0];

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);

  if (image) {
    formData.append("image", image);
  }

  const res = await fetch("https://nexa-project-l5pg.onrender.com/api/articles/add", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById("status").innerText = "Article Published!";
    e.target.reset();
  } else {
    document.getElementById("status").innerText = "Failed to publish!";
  }
});
