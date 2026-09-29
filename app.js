const hero = document.getElementById("hero");
const caption = document.getElementById("caption");
const count = document.getElementById("count");
const filters = document.getElementById("filters");
const thumbs = document.getElementById("thumbs");
let groups = [];
let items = [];
let index = 0;

function show(next) {
  if (!items.length) return;
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
  [...thumbs.children].forEach((button, i) => button.setAttribute("aria-selected", i === index ? "true" : "false"));
  const current = thumbs.children[index];
  if (current) current.scrollIntoView({ inline: "center", block: "nearest" });
}

function setGroup(id) {
  const group = id === "all" ? { items: groups.flatMap(g => g.items) } : groups.find(g => g.id === id);
  items = (group && group.items) || [];
  thumbs.innerHTML = "";
  items.forEach((item, i) => {
    const button = document.createElement("button");
    button.type = "button";
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = "";
    button.appendChild(img);
    button.addEventListener("click", () => show(i));
    thumbs.appendChild(button);
  });
  [...filters.children].forEach(button => button.setAttribute("aria-selected", button.dataset.id === id ? "true" : "false"));
  show(0);
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

fetch("manifest.json")
  .then(response => response.json())
  .then(data => {
    groups = data.groups || [];
    const total = groups.reduce((n, group) => n + group.items.length, 0);
    chip("all", "All", total);
    groups.forEach(group => chip(group.id, group.label, group.items.length));
    setGroup("all");
  });
