/*!
 * Moodle No-Plugin Gallery + Lightbox (vanilla JS)
 * Transforme l'activité Dossier en galerie de vignettes avec lightbox.
 * Aucune dépendance. S'active uniquement sur .path-mod-folder
 */

(() => {
    "use strict";
  
    // --- Helpers ---
    const isFolderPage = () => document.body.classList.contains("path-mod-folder");
    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  
    // Filtre des extensions d'images qui déclenchent la lightbox
    const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)($|\?)/i;
  
    // Attendre que l'arbre de fichiers soit présent
    function whenReady(fn, retries = 100, delay = 120) {
      const tick = () => {
        const ok = q(".filemanager .ygtvitem") && q(".foldertree");
        if (ok) fn();
        else if (retries-- > 0) setTimeout(tick, delay);
      };
      tick();
    }
  
    // Injection CSS+HTML lightbox une seule fois
    function ensureLightboxScaffold() {
      if (q(".lb-overlay")) return;
  
      const style = document.createElement("style");
      style.textContent = `
  /* Galerie */
  .foldertree .gallery-folder{border:1px solid #ddd;margin:8px 0;padding:8px;border-radius:10px;background:#fff}
  .foldertree .gallery-folder-title{margin:.2rem 0 .6rem;font-weight:600}
  .foldertree .gallery-grid{display:flex;flex-wrap:wrap;gap:8px}
  .foldertree .gallery-item{display:flex;flex-direction:column;align-items:center;width:120px}
  .foldertree .gallery-item img{width:100%;height:auto;display:block;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .foldertree .gallery-caption{width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;margin-top:4px;text-align:center}
  @media (min-width:720px){ .foldertree .gallery-item{width:150px} }
  
  /* Lightbox */
  .lb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:99999}
  .lb-overlay.lb-open{display:flex}
  .lb-stage{position:relative;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center}
  .lb-imgwrap{max-width:90vw;max-height:80vh;display:flex;align-items:center;justify-content:center}
  .lb-imgwrap img{max-width:90vw;max-height:80vh;display:block;border-radius:8px}
  .lb-caption{color:#fff;margin-top:.6rem;font-size:.95rem;text-align:center;max-width:90vw;word-break:break-word}
  .lb-close,.lb-prev,.lb-next{
    position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);
    color:#fff;border:none;border-radius:999px;width:44px;height:44px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;font-size:20px;
  }
  .lb-close{top:12px;right:12px;transform:none}
  .lb-prev{left:-56px}
  .lb-next{right:-56px}
  @media (max-width:720px){ .lb-prev{left:8px} .lb-next{right:8px} }
  .lb-close:hover,.lb-prev:hover,.lb-next:hover{background:rgba(255,255,255,.22)}
  body.lb-lock{overflow:hidden}
      `;
      document.head.appendChild(style);
  
      const overlay = document.createElement("div");
      overlay.className = "lb-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Image en grand (lightbox)");
      overlay.innerHTML = `
        <div class="lb-stage">
          <button class="lb-close" aria-label="Fermer (Échap)">&times;</button>
          <button class="lb-prev" aria-label="Précédent">&#10094;</button>
          <div class="lb-imgwrap"><img alt=""></div>
          <button class="lb-next" aria-label="Suivant">&#10095;</button>
          <div class="lb-caption" aria-live="polite"></div>
        </div>`;
      document.body.appendChild(overlay);
    }
  
    // Construit la galerie à partir de l'arbre .filemanager
    function buildGallery() {
      if (!isFolderPage()) return;
      const filemanager = q(".filemanager");
      const folderTree = q(".foldertree");
      if (!filemanager || !folderTree) return;
      if (folderTree.dataset.galleryBuilt === "1") return; // idempotent
  
      const rootItem = q(".filemanager .ygtvitem");
      const items = qa(".ygtvitem", rootItem);
  
      let html = "";
      const stack = [];
      const files = []; // {src, title, isImage}
  
      const getDepth = (table) => {
        for (let d = 0; d <= 10; d++) {
          if (table.classList.contains("ygtvdepth" + d)) return d;
        }
        return 0;
      };
  
      items.forEach((item) => {
        const table = q("table", item);
        if (!table) return;
        const level = getDepth(table);
  
        // Fermer les dossiers si on remonte
        while (level < stack.length) {
          html += `</div>`; // ferme .gallery-grid OU .gallery-folder
          html += `</div>`; // ferme .gallery-folder wrapper
          stack.pop();
        }
  
        const hasChild = !!q(".ygtvitem", item);
        const nameEl = q(".fp-filename", item);
        const title = nameEl ? nameEl.textContent.trim() : "—";
  
        if (hasChild) {
          // Dossier
          const h = Math.min(level + 1, 6);
          html += `<div class="gallery-folder"><h${h} class="gallery-folder-title">${title}</h${h}><div class="gallery-grid">`;
          stack.push(title);
        } else {
          // Fichier
          const imgEl = q("img", item);
          let thumb = "";
          let link = "";
  
          if (imgEl && imgEl.src) {
            if (imgEl.src.includes("?preview=tinyicon")) {
              thumb = imgEl.src.replace("?preview=tinyicon", "?preview=thumb");
              link = imgEl.src.replace("?preview=tinyicon", "?link=open");
            } else if (imgEl.src.includes("?preview=")) {
              thumb = imgEl.src.replace(/preview=[^&]+/, "preview=thumb");
              link = imgEl.src.replace(/preview=[^&]+/, "link=open");
            } else {
              thumb = imgEl.src;
              link = imgEl.src;
            }
          }
  
          const isImage = IMG_EXT.test(link || "") || IMG_EXT.test(title || "");
          const index = files.length;
          files.push({ src: link, title, isImage });
  
          html += `
            <div class="gallery-item" title="${escapeHtml(title)}">
              <a href="${link}" data-index="${index}" class="gallery-link"${isImage ? "" : ' target="_blank" rel="noopener"'} >
                <img src="${thumb}" alt="${escapeHtml(title)}" loading="lazy">
              </a>
              <div class="gallery-caption" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            </div>`;
        }
      });
  
      // Fermer dossiers restants
      while (stack.length) {
        html += `</div></div>`;
        stack.pop();
      }
  
      // Cache l'arbre d'origine et insère la galerie
      filemanager.style.display = "none";
      folderTree.insertAdjacentHTML("beforeend", html);
      folderTree.dataset.galleryBuilt = "1";
  
      // Activer lightbox
      enableLightbox(files, folderTree);
    }
  
    function enableLightbox(files, container) {
      ensureLightboxScaffold();
  
      const overlay = q(".lb-overlay");
      const img = q(".lb-imgwrap img", overlay);
      const cap = q(".lb-caption", overlay);
      const bClose = q(".lb-close", overlay);
      const bPrev = q(".lb-prev", overlay);
      const bNext = q(".lb-next", overlay);
  
      let idx = -1;
  
      const openAt = (i) => {
        if (i < 0 || i >= files.length) return;
        idx = i;
        const { src, title } = files[idx];
        img.src = src;
        img.alt = title || "";
        cap.textContent = title || "";
        overlay.classList.add("lb-open");
        document.body.classList.add("lb-lock");
      };
  
      const closeLb = () => {
        overlay.classList.remove("lb-open");
        document.body.classList.remove("lb-lock");
        img.src = "";
        idx = -1;
      };
  
      const next = () => {
        // sauter les non-images
        let i = idx;
        for (let step = 0; step < files.length; step++) {
          i = (i + 1) % files.length;
          if (files[i].isImage) return openAt(i);
        }
      };
  
      const prev = () => {
        let i = idx;
        for (let step = 0; step < files.length; step++) {
          i = (i - 1 + files.length) % files.length;
          if (files[i].isImage) return openAt(i);
        }
      };
  
      // Clic sur vignettes
      qa(".gallery-link", container).forEach((a) => {
        const i = parseInt(a.getAttribute("data-index") || "-1", 10);
        a.addEventListener("click", (e) => {
          // empêcher seulement si c'est une image
          if (files[i]?.isImage) {
            e.preventDefault();
            openAt(i);
          }
        });
      });
  
      // Boutons
      bClose.addEventListener("click", closeLb);
      bNext.addEventListener("click", next);
      bPrev.addEventListener("click", prev);
  
      // Fermer au clic hors stage
      overlay.addEventListener("click", (e) => {
        const stage = q(".lb-stage", overlay);
        if (!stage.contains(e.target)) closeLb();
      });
  
      // Clavier
      window.addEventListener(
        "keydown",
        (e) => {
          if (!overlay.classList.contains("lb-open")) return;
          if (e.key === "Escape") closeLb();
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") prev();
        },
        { passive: true }
      );
  
      // Gestes tactiles (swipe)
      let sx = 0;
      overlay.addEventListener(
        "touchstart",
        (e) => {
          sx = e.changedTouches[0].clientX;
        },
        { passive: true }
      );
      overlay.addEventListener(
        "touchend",
        (e) => {
          const dx = e.changedTouches[0].clientX - sx;
          if (Math.abs(dx) > 40) {
            if (dx < 0) next();
            else prev();
          }
        },
        { passive: true }
      );
    }
  
    function escapeHtml(s) {
      return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  
    // --- Boot ---
    if (!isFolderPage()) return;
    whenReady(buildGallery);
  })();
  