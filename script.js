const fileInput = document.getElementById("fileInput");
const exportBtn = document.getElementById("exportBtn");
const pagesDiv = document.getElementById("pages");
const loadingContainer = document.getElementById("loadingContainer");
const loadingBar = document.getElementById("loadingBar");
const loadingText = document.getElementById("loadingText");

let flashcards = [];

function updateProgress(percentage) {
  loadingBar.style.setProperty("--progress", `${Math.min(percentage, 100)}%`);
  loadingText.textContent = `${Math.min(Math.round(percentage), 100)}%`;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 8;
const GAP = 1;
const CARD_RATIO = null;

fileInput.addEventListener("change", handleFile);
exportBtn.addEventListener("click", exportPDF);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    skipEmptyLines: true,
    complete: function (results) {

      const rows = results.data;

      if (rows.length < 2) {
        alert("CSV needs header + data");
        return;
      }

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

function calculateLayout() {

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const usableHeight = PAGE_HEIGHT - MARGIN * 2;

  const preferredCounts = [32, 28, 24, 20, 16, 12, 10, 9, 8, 6, 4];

  let best = null;

  for (let cols = 2; cols <= 8; cols++) {
    for (let rows = 2; rows <= 8; rows++) {

      const count = cols * rows;
      if (!preferredCounts.includes(count)) continue;

      const totalGapX = GAP * (cols - 1);
      const totalGapY = GAP * (rows - 1);

      const cardWidth = (usableWidth - totalGapX) / cols;
      const cardHeight = (usableHeight - totalGapY) / rows;

      const area = cardWidth * cardHeight;

      if (!best || count > best.count || (count === best.count && area > best.area)) {
        best = { cols, rows, count, area };
      }
    }
  }

  return best || { cols: 4, rows: 4, count: 16 };
}

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
  page.setAttribute('data-cols', String(layout.cols));
  pagesDiv.appendChild(page);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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

  loadingContainer.style.display = "block";
  updateProgress(0);

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true
  });

  for (let i = 0; i < pages.length; i++) {

    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.85);

    if (i > 0) pdf.addPage();

    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);

    canvas.width = 0;
    canvas.height = 0;

    const progress = ((i + 1) / pages.length) * 100;
    updateProgress(progress);
  }

  pdf.save("flashcards.pdf");

  loadingContainer.style.display = "none";
}
