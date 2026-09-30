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
  if (id === "faces") return apply(allItems.filter(item => item.faces && item.lane === "events"), id);
  if (id === "noface") return apply(allItems.filter(item => !item.faces && item.lane === "events"), id);
  if (id.startsWith("event:")) {
    const eventId = id.slice(6);
    return apply(allItems.filter(item => item.event === eventId), id);
  }
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
    if (detail.lane === "faces" && !item.faces) return false;
    if (detail.lane === "noface" && item.faces) return false;
    if (detail.lane && detail.lane !== "faces" && detail.lane !== "noface" && item.lane !== detail.lane) return false;
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
    const shown = allItems.filter(item => item.lane === "events");
    if (summary) {
      summary.textContent = `${shown.length} photographs saved from the Uttoron WhatsApp groups. Each caption starts with WhatsApp. Pictures whose text is something else are set aside. August and September are the only months those chats still had.`;
    }
    chip("events", "Uttoron on WhatsApp", shown.length);
    chip("faces", "With a face", shown.filter(item => item.faces).length);
    chip("noface", "No face", shown.filter(item => !item.faces).length);
    groups.filter(group => group.id === "events").forEach(group => {
      (group.events || []).forEach(event => chip("event:" + event.id, event.label, event.count));
    });
    const aside = groups.find(group => group.id === "aside");
    if (aside) chip("aside", "Screenshot from the chat", aside.items.length);
    setGroup("events");
  });
