const hero = document.getElementById("hero");
const caption = document.getElementById("caption");
const count = document.getElementById("count");
const filters = document.getElementById("filters");
const thumbs = document.getElementById("thumbs");
const summary = document.getElementById("summary");
let groups = [];
let allItems = [];
let items = [];
let index = 0;
let activeChip = "all";

function show(next) {
  if (!items.length) {
    hero.removeAttribute("src");
    caption.textContent = "Nothing in this view";
    count.textContent = "00 / 00";
    thumbs.innerHTML = "";
    return;
  }
  index = (next + items.length) % items.length;
  const item = items[index];
  hero.classList.add("is-fading");
  window.setTimeout(() => {
    hero.src = item.src;
    hero.alt = item.label;
    caption.textContent = item.label;
    count.textContent = String(index + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
    hero.classList.remove("is-fading");
  }, 120);
  drawThumbs();
}

function drawThumbs() {
  thumbs.innerHTML = "";
  const start = Math.max(0, index - 12);
  const end = Math.min(items.length, start + 24);
  for (let i = start; i < end; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-selected", i === index ? "true" : "false");
    const img = document.createElement("img");
    img.src = items[i].src;
    img.alt = "";
    button.appendChild(img);
    button.addEventListener("click", () => show(i));
    thumbs.appendChild(button);
  }
}

function apply(list, chipId) {
  items = list;
  activeChip = chipId || "all";
  [...filters.children].forEach(button => {
    button.setAttribute("aria-selected", button.dataset.id === activeChip ? "true" : "false");
  });
  show(0);
}

function setGroup(id) {
  const group = id === "all" ? null : groups.find(entry => entry.id === id);
  apply(group ? group.items : allItems, id);
}

function chip(id, label, n) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.id = id;
  button.textContent = label + " · " + n;
  button.addEventListener("click", () => setGroup(id));
  filters.appendChild(button);
}

document.querySelector(".prev").addEventListener("click", () => show(index - 1));
document.querySelector(".next").addEventListener("click", () => show(index + 1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") show(index + 1);
  if (event.key === "ArrowLeft") show(index - 1);
});

window.addEventListener("library-select", (event) => {
  const detail = event.detail || {};
  const list = allItems.filter(item => {
    if (detail.month && item.month !== detail.month) return false;
    if (detail.lane && item.lane !== detail.lane) return false;
    if (detail.eventId && item.event !== detail.eventId) return false;
    return true;
  });
  apply(list, detail.lane || "all");
});

fetch("manifest.json")
  .then(response => response.json())
  .then(data => {
    groups = data.groups || [];
    allItems = groups.flatMap(group => group.items);
    const months = new Set(allItems.map(item => item.month).filter(Boolean));
    if (summary && data.count) {
      summary.textContent = `${data.count} pictures from ${months.size} months in 2026. Events stay together. Tickets, product prompts, cues, and internal notes each have their own lane. Use the chart to zoom into a month or a lane.`;
    }
    chip("all", "All", allItems.length);
    groups.forEach(group => chip(group.id, group.label, group.items.length));
    setGroup("all");
  });
