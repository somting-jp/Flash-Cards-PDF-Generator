const fileInput = document.getElementById("fileInput");
const exportBtn = document.getElementById("exportBtn");
const pagesDiv = document.getElementById("pages");

let flashcards = [];

/* A4 settings (mm) */
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 8;   // smaller page margin (mm)
const GAP = 1;      // tighter gap between cards (mm) to pack more per page
const CARD_RATIO = null; // not enforcing a fixed aspect ratio (allow non-square cards)

fileInput.addEventListener("change", handleFile);
exportBtn.addEventListener("click", exportPDF);




/* 📥 Load CSV */
function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    skipEmptyLines: true,
    complete: function(results) {

      const rows = results.data;

      if (rows.length < 2) {
        alert("CSV needs header + data");
        return;
      }

      /* Skip header + validate rows */
      flashcards = rows
        .slice(1)
        .filter(r => r && r.length >= 2 && r[0] && r[1]);

      if (!flashcards.length) {
        alert("No valid flashcards found");
        return;
      }

      buildPages(flashcards);
    }
  });
}




/* 🧮 Calculate best layout (paper efficient) */
function calculateLayout() {

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const usableHeight = PAGE_HEIGHT - MARGIN * 2;

  /* Prefer higher counts (saves paper). Include larger layouts. */
  const preferredCounts = [32, 28, 24, 20, 16, 12, 10, 9, 8, 6, 4];

  let best = null;

  // search a wider grid space to find denser layouts
  for (let cols = 2; cols <= 8; cols++) {
    for (let rows = 2; rows <= 8; rows++) {

      const count = cols * rows;
      if (!preferredCounts.includes(count)) continue;

      const totalGapX = GAP * (cols - 1);
      const totalGapY = GAP * (rows - 1);

      // Allow rectangular cards that fully use the available cell
      const cardWidth = (usableWidth - totalGapX) / cols;
      const cardHeight = (usableHeight - totalGapY) / rows;

      const area = cardWidth * cardHeight;

      // Prefer layouts with MORE cards first, then pick the one with the
      // larger card area among layouts with the same count.
      if (!best || count > best.count || (count === best.count && area > best.area)) {
        best = { cols, rows, count, area };
      }
    }
  }

  return best || { cols: 4, rows: 4, count: 16 };
}




/* 📄 Build pages */
function buildPages(cards) {

  pagesDiv.innerHTML = "";

  const layout = calculateLayout();
  const perPage = layout.count;

  for (let i = 0; i < cards.length; i += perPage) {

    const chunk = cards.slice(i, i + perPage);

    createPage(chunk, layout, "front");
    createPage(chunk, layout, "back");
  }
}




/* 🧱 Create page */
function createPage(cards, layout, side) {

  const page = document.createElement("div");
  page.className = "page";

  if (side === "back") {
    page.classList.add("back-page");
  }

  const grid = document.createElement("div");
  grid.className = "grid";

  grid.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  grid.style.gap = `${GAP}mm`;

  grid.innerHTML = cards.map(card => {

    const content = side === "front" ? card[0] : card[1];
    const cls = side === "back" ? "card back" : "card";

    return `<div class="${cls}">${escapeHtml(content)}</div>`;

  }).join("");

  page.appendChild(grid);
  // mark page with cols to allow compact styling when many cards fit
  page.setAttribute('data-cols', String(layout.cols));
  pagesDiv.appendChild(page);
}




/* 🔒 Escape HTML */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}




/* 🖨 Export PDF (optimized & stable) */
async function exportPDF() {

  if (!flashcards.length) {
    alert("Upload CSV first");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pages = document.querySelectorAll(".page");

  if (!pages.length) {
    alert("No pages to export");
    return;
  }

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true          // ✅ enable compression
  });

  for (let i = 0; i < pages.length; i++) {

    const canvas = await html2canvas(pages[i], {
      scale: 2,             // ✅ balanced sharpness & memory
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    // ✅ Use JPEG instead of PNG (much smaller)
    const imgData = canvas.toDataURL("image/jpeg", 0.85);

    if (i > 0) pdf.addPage();

    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);

    // ✅ Free memory immediately (important for many pages)
    canvas.width = 0;
    canvas.height = 0;
  }

  pdf.save("flashcards.pdf");
}
