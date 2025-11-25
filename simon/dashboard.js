/*****************************************************
 *  DASHBOARD.JS (FINAL VERSION)
 * Features:
 *  - User data loading
 *  - Wallet balance display & refresh
 *  - Withdrawals (modal)
 *  - Transaction & wallet log history
 *  - Referral system (₦6,000 bonus ready)
 *****************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(sessionStorage.getItem("user"));

  if (!user) {
    alert("Please log in first.");
    window.location.href = "login.html";
    return;
  }

  window.user = user;

  // Example: after user edits profile
function updateDashboardProfile(newProfileUrl, newUsername) {
  const dashboardPic = document.getElementById('dashboardPic');
  const usernameDisplay = document.getElementById('usernameDisplay');

  dashboardPic.src = newProfileUrl || 'images/default-avatar.png';
  usernameDisplay.textContent = newUsername || 'Username';
}

// Example usage (fetch from server or local storage)
fetch(`https://nexa-project-l5pg.onrender.com/api/user/${user.username}`)
  .then(res => res.json())
  .then(user => {
    updateDashboardProfile(user.profile_pic, user.username);
  })
  .catch(err => console.error(err));

  /*****************************************************
   * 👤 LOAD USER DETAILS
   *****************************************************/
  async function loadUserData(username) {
    try {
       const res = await fetch(`https://nexa-project-l5pg.onrender.com/api/user/${username}`);
       const data = await res.json();

      if (data.success) {
        document.getElementById("userName").textContent =
          data.user.fullname || username;
        console.log("User data:", data.user);
      } else {
        alert("User not found!");
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }

  /*****************************************************
   * 💰 LOAD WALLET BALANCE
   *****************************************************/
  async function loadWallet(username) {
    try {
      const res = await fetch(`https://nexa-project-l5pg.onrender.com/api/wallet/${username}`);
      const data = await res.json();

      if (data.success) {
        document.getElementById("totalBalance").textContent = `₦${Number(
          data.wallet.total_balance
        ).toFixed(2)}`;
        document.getElementById("affiliateBalance").textContent = `₦${Number(
          data.wallet.affiliate_balance
        ).toFixed(2)}`;
        document.getElementById("bonusBalance").textContent = `₦${Number(
          data.wallet.bonus_balance
        ).toFixed(2)}`;
      } else {
        console.warn("Wallet not found for this user.");
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  }

  // ✅ Load on startup
  loadUserData(user.username);
  loadWallet(user.username);

  /*****************************************************
   * 🔁 REFRESH BALANCE BUTTON
   *****************************************************/
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.textContent = "Refreshing...";
      refreshBtn.disabled = true;
      await loadWallet(user.username);
      refreshBtn.textContent = "Refresh Balance";
      refreshBtn.disabled = false;
    });
  }

  const username = user.username;

fetch(`https://nexa-project-l5pg.onrender.com/api/transactions/${username}`)

  .then(res => res.json())
  .then(data => {
    if (data.success) {
      const historyEl = document.getElementById("transactionHistory");
      data.transactions.forEach(tx => {
        const row = document.createElement("div");
        row.className = "transaction-row";
        row.innerHTML = `
          <span>${new Date(tx.date).toLocaleString()}</span>
          <span>${tx.type}</span>
          <span>${tx.amount > 0 ? "+" : "-"}₦${Math.abs(tx.amount).toLocaleString()}</span>
          <span>${tx.note || ""}</span>
        `;
        historyEl.appendChild(row);
      });
    }
  });

  /*****************************************************
   * 🤝 REFERRAL LINK LOGIC (₦6000 SYSTEM READY)
   *****************************************************/
  const refInput = document.getElementById("refLink");
  const copyBtn = document.getElementById("copyBtn");

  if (refInput) {
    const referralLink = `${window.location.origin}/sign-up.html?ref=${user.username}`;
    refInput.value = referralLink;

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(referralLink);
          alert("Referral link copied!");
        } catch (err) {
          // Fallback for browsers not supporting clipboard API
          refInput.select();
          document.execCommand("copy");
          alert("Referral link copied!");
        }
      });
    }
  }

  /*****************************************************
   * 🚪 LOGOUT FUNCTIONALITY
   *****************************************************/
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  /*****************************************************
   * 📱 SIDEBAR TOGGLE (MOBILE + DESKTOP)
   *****************************************************/
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleSidebar");

  if (sidebar && toggleBtn) {
    const overlay = document.createElement("div");
    overlay.classList.add("overlay");
    document.body.appendChild(overlay);

    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("show");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("show");
      overlay.classList.remove("active");
    });

    document.querySelectorAll(".sidebar nav a").forEach((link) => {
      link.addEventListener("click", () => {
        sidebar.classList.remove("show");
        overlay.classList.remove("active");
      });
    });
  }

  /*****************************************************
   * 💸 WITHDRAWAL MODAL LOGIC
   *****************************************************/
  const withdrawBtn = document.querySelector(".withdraw-btn");
  const modal = document.getElementById("withdrawModal");
  const closeModal = document.getElementById("closeModal");
  const withdrawForm = document.getElementById("withdrawForm");

  if (withdrawBtn && modal) {
    withdrawBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });
  }

  if (closeModal && modal) {
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const amount = parseFloat(document.getElementById("withdrawAmount").value);
      const bankName = document.getElementById("bankName").value.trim();
      const accountNumber = document.getElementById("accountNumber").value.trim();

      if (amount <= 0) {
        alert("Enter a valid amount!");
        return;
      }

      try {
        const res = await fetch("https://nexa-project-l5pg.onrender.com/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: user.username,
            amount,
            bank_name: bankName,
            account_number: accountNumber,
          }),
        });

        const data = await res.json();

        if (data.success) {
          alert(data.message);
          modal.style.display = "none";
          await loadWallet(user.username);
          loadTransactionHistory(user.username);
          loadWalletLogs(user.username);
        } else {
          alert("⚠️ " + data.message);
        }
      } catch (err) {
        console.error("Error submitting withdrawal:", err);
        alert("⚠️ Could not connect to the server.");
      }
    });
  }

  /*****************************************************
   * 📜 TRANSACTION HISTORY
   *****************************************************/
  async function loadTransactionHistory(username) {
    try {
      const res = await fetch(`https://nexa-project-l5pg.onrender.com/api/transactions/${username}`);
      const data = await res.json();

      const table = document.getElementById("transactionTableBody");
      if (!table) return;

      if (!data.transactions || data.transactions.length === 0) {
        table.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-2">No transactions yet.</td></tr>`;
        return;
      }

      table.innerHTML = data.transactions
        .map(
          (t) => `
          <tr>
            <td>${t.type}</td>
            <td>₦${Number(t.amount).toFixed(2)}</td>
            <td>${t.note || "-"}</td>
            <td>${new Date(t.created_at).toLocaleString()}</td>
          </tr>
        `
        )
        .join("");
    } catch (err) {
      console.error("Error loading transaction history:", err);
    }
  }

  /*****************************************************
   * 📘 WALLET LOG HISTORY
   *****************************************************/
  async function loadWalletLogs(username) {
    try {
      const res = await fetch(`https://nexa-project-l5pg.onrender.com/api/wallet/logs/${username}`);
      const data = await res.json();

      const container = document.getElementById("walletLogs");
      if (!container) return;

      if (!data.logs || data.logs.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-sm text-center">No wallet activity yet.</p>`;
        return;
      }

      container.innerHTML = data.logs
        .map(
          (log) => `
          <div class="border-b border-gray-200 py-2 flex justify-between text-sm">
            <span>${log.description || log.reason || "—"}</span>
            <span class="${
              log.amount < 0 ? "text-red-500" : "text-green-500"
            }">
              ${log.amount < 0 ? "-" : "+"}₦${Math.abs(
            Number(log.amount)
          ).toFixed(2)}
            </span>
          </div>
        `
        )
        .join("");
    } catch (err) {
      console.error("Error loading wallet logs:", err);
    }
  }

  // Open withdraw modal from bottom nav icon
const bottomWithdraw = document.getElementById("bottomWithdraw");
const withdrawModal = document.getElementById("withdrawModal");

if (bottomWithdraw && withdrawModal) {
  bottomWithdraw.addEventListener("click", (e) => {
    e.preventDefault(); // prevent default link behavior
    withdrawModal.style.display = "flex";
  });
}

  /*****************************************************
   * 🚀 INITIALIZE DASHBOARD DATA
   *****************************************************/
  loadTransactionHistory(user.username);
  loadWalletLogs(user.username);
});
