// Sample list of contacts
const contacts = [
  {
    name: "OG Media",
    phone: "2349047581803",
    image: "images/Nexa 6.jpg"
  },
  {
    name: "Anietie Etienne",
    phone: "09137046436",
    image: "images/Nexa 7.jpg"
  },
  {
    name: "Bethel Media",
    phone: "2347015958997",
    image: "images/Nexa 5.jpg"
  },
   {
    name: "Emmy Kash",
    phone: "2348084459552",
    image: "images/Nexa 8.jpg"
  },
     {
    name: "Queen Esther Media",
    phone: "2348104561348",
    image: "images/Nexa 9.jpg"
  },
       {
    name: "Kira",
    phone: "2348100153882",
    image: "images/Nexa 10.jpg"
  },
         {
    name: "Naijastreet Voice",
    phone: "2347084988867",
    image: "images/Nexa 11.jpg"
  },
           {
    name: "De Current Tv",
    phone: "2349126105323",
    image: "images/Nexa 12.jpg"
  },
             {
    name: "Jerry Media",
    phone: "2349060264986",
    image: "images/Nexa 13.jpg"
  },
             {
    name: "Star Chay",
    phone: "2349125514148",
    image: "images/Nexa 14.jpg"
  },
               {
    name: "Debbydayo",
    phone: "2348126295376",
    image: "images/Nexa 3.jpg"
  }
];

// Load contacts into the page
const container = document.getElementById("contactList");

contacts.forEach(c => {
  const card = document.createElement("div");
  card.className = "contact-card";

  card.innerHTML = `
    <img src="${c.image}" alt="${c.name}">
    <div class="contact-info">
      <div class="contact-phone">${c.phone}</div>
      <div class="contact-name">${c.name}</div>
    </div>
  `;

  card.onclick = () => {
    window.location.href = `https://wa.me/${c.phone}`;
  };

  container.appendChild(card);
});
