#!/usr/bin/env bash
set -euo pipefail

# Create folders
mkdir -p assets/css assets/js assets/fonts assets/vendor/iziToast

echo "Downloading CSS files..."
curl -L -o assets/css/bootstrap-grid.min.css "https://unpkg.com/bootstrap/dist/css/bootstrap-grid.min.css"
curl -L -o assets/css/swiper-bundle.min.css "https://unpkg.com/swiper/swiper-bundle.min.css"
curl -L -o assets/css/magnific-popup.min.css "https://cdnjs.cloudflare.com/ajax/libs/magnific-popup.js/1.1.0/magnific-popup.min.css"
curl -L -o assets/css/fontawesome-all.min.css "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
curl -L -o assets/css/remixicon.css "https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css"
curl -L -o assets/css/iziToast.min.css "https://cdn.jsdelivr.net/npm/izitoast@1.4.0/dist/css/iziToast.min.css"

echo "Downloading JS files..."
curl -L -o assets/js/jquery.min.js "https://code.jquery.com/jquery-3.7.1.min.js"
curl -L -o assets/js/swiper-bundle.min.js "https://unpkg.com/swiper/swiper-bundle.min.js"
curl -L -o assets/js/gsap.min.js "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"
curl -L -o assets/js/ScrollSmoother.min.js "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollSmoother.min.js"
curl -L -o assets/js/ScrollTrigger.min.js "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"
curl -L -o assets/js/ScrollToPlugin.min.js "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollToPlugin.min.js"
curl -L -o assets/js/jquery.magnific-popup.min.js "https://cdnjs.cloudflare.com/ajax/libs/magnific-popup.js/1.1.0/jquery.magnific-popup.min.js"
curl -L -o assets/js/iziToast.min.js "https://cdn.jsdelivr.net/npm/izitoast@1.4.0/dist/js/iziToast.min.js"

echo "Downloading icon fonts referenced by remixicon & fontawesome..."
# Remixicon fonts (the CSS refers to ../fonts/remixicon.woff2 etc)
curl -L -o assets/fonts/remixicon.woff2 "https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.woff2"
curl -L -o assets/fonts/remixicon.woff "https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.woff"

# Font Awesome (download woff2)
curl -L -o assets/fonts/fa-solid-900.woff2 "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2"
curl -L -o assets/fonts/fa-regular-400.woff2 "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-regular-400.woff2"
curl -L -o assets/fonts/fa-brands-400.woff2 "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2"

echo "Fixing local CSS font paths where needed..."
# Remixicon CSS refers to ../fonts/..., adjust to our assets path
sed -i.bak 's@url(../fonts/remixicon@url(../fonts/remixicon@g' assets/css/remixicon.css || true

echo "Done. Files saved under assets/ (css, js, fonts, vendor)"
