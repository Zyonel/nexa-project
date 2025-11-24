document.addEventListener("DOMContentLoaded", loadArticles);

async function loadArticles() {
    const container = document.getElementById("articlesContainer");

    try {
        const res = await fetch("http://localhost:3000/api/articles");
        const data = await res.json();

        if (!data.success) {
            container.innerHTML = "<p class='loading'>Failed to load articles.</p>";
            return;
        }

        if (data.articles.length === 0) {
            container.innerHTML = "<p class='loading'>No articles available yet.</p>";
            return;
        }

        container.innerHTML = "";

        data.articles.forEach(article => {
            const card = document.createElement("div");
            card.className = "article-card";

            const imgSrc = article.image 
                ? `http://localhost:3000${article.image}`
                : "images/default-article.jpg";

            card.innerHTML = `
                <img src="${imgSrc}" class="article-img">
                <div class="article-content">
                    <h3 class="article-title">${article.title}</h3>
                    <p class="article-snippet">${article.content.substring(0, 120)}...</p>
                    <button class="read-btn" onclick="openArticle(${article.id})">Read More</button>
                </div>
            `;

            container.appendChild(card);
        });

        // GSAP animation
       /* gsap.from(".article-card", {
            opacity: 0,
            y: 25,
            duration: 0.4,
            stagger: 0.1
        }); */

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p class='loading'>Error loading articles.</p>";
    }
}

function openArticle(id) {
    window.location.href = `article-details.html?id=${id}`;
}
