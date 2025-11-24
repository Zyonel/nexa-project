document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("transactionList");

  // Load the stored user object from sessionStorage
  const user = JSON.parse(sessionStorage.getItem("user"));

  if (!user) {
    listEl.innerHTML = "<p>Please log in to view your transactions.</p>";
    return;
  }

  // Extract the username from the stored user object
  const username = user.username;

  fetch(`https://nexa-project-l5pg.onrender.com/api/transactions/${username}`)

    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.transactions.length) {
        listEl.innerHTML = "<p>No transactions yet.</p>";
        return;
      }

      data.transactions.forEach(tx => {
        const row = document.createElement("div");
        row.className = "transaction-row";

        const amount = Number(tx.amount || 0);

        // Add credit or debit class
        row.classList.add(amount >= 0 ? "credit" : "debit");

        row.innerHTML = `
          <span>${new Date(tx.date).toLocaleString()}</span>
          <span>${tx.type.replace("_", " ").toUpperCase()}</span>
          <span>${amount >= 0 ? "+" : "-"}₦${Math.abs(amount).toLocaleString()}</span>
          <span>${tx.note || ""}</span>
        `;

        listEl.appendChild(row);
      });
    })
    .catch(err => {
      console.error("Error fetching transactions:", err);
      listEl.innerHTML = "<p>Failed to load transactions. Try again later.</p>";
    });
});
