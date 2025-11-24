const fetch = require("node-fetch");

async function checkCode(userCode) {
  const res = await fetch("http://your-generator-site.com/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: userCode }),
  });
  const result = await res.json();
  console.log(result);
  if (result.valid) {
    console.log("✅ Code is valid, grant access");
  } else {
    console.log("❌ Invalid code:", result.reason);
  }
}
