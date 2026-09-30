const svg = d3.select("#map");
const width = () => svg.node().clientWidth || 960;
let selected = null;

function layout(data) {
  const months = data.nodes.filter(node => node.type === "month");
  const lanes = data.nodes.filter(node => node.type === "lane");
  const events = data.nodes.filter(node => node.type === "event");
  const height = Math.max(560, 70 + Math.max(months.length, lanes.length, events.length) * 42);
  svg.attr("viewBox", `0 0 ${Math.max(width(), 980)} ${height}`);
  const columns = { year: 90, month: 280, lane: 520, event: 800 };
  data.nodes.forEach(node => {
    node.x = columns[node.type] || 800;
  });
  place(data.nodes.filter(node => node.type === "year"), height);
  place(months, height);
  place(lanes, height);
  place(events, height);
  return height;
}

function place(nodes, height) {
  const gap = nodes.length ? (height - 80) / nodes.length : 0;
  nodes.forEach((node, index) => {
    node.y = 50 + gap * index + gap / 2;
  });
}

function radius(node) {
  return node.type === "year" ? 28 : 10 + Math.min(18, Math.sqrt(node.count || 1) * 1.6);
}

function color(node) {
  if (node.type === "year") return "#ff5400";
  if (node.type === "month") return "#ff8800";
  if (node.type === "lane") return "#2a2118";
  return "#c6531a";
}

fetch("graph.json")
  .then(response => response.json())
  .then(data => {
    layout(data);
    const root = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.5, 3.2]).on("zoom", event => {
      root.attr("transform", event.transform);
    }));
    const link = root.append("g")
      .selectAll("path")
      .data(data.links)
      .join("path")
      .attr("class", "link")
      .attr("d", item => {
        const source = data.nodes.find(node => node.id === item.source);
        const target = data.nodes.find(node => node.id === item.target);
        return d3.linkHorizontal()({ source: [source.x, source.y], target: [target.x, target.y] });
      });
    const node = root.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", item => `translate(${item.x},${item.y})`)
      .style("cursor", "pointer")
      .on("click", (event, item) => {
        event.stopPropagation();
        selected = selected && selected.id === item.id ? null : item;
        paint(node, link);
        const detail = { month: "", lane: "", eventId: "" };
        if (selected && selected.type === "month") detail.month = selected.id;
        if (selected && selected.type === "lane") detail.lane = selected.id;
        if (selected && selected.type === "event") {
          detail.lane = selected.lane;
          detail.eventId = selected.event;
        }
        window.dispatchEvent(new CustomEvent("library-select", { detail }));
      });
    node.append("circle")
      .attr("r", radius)
      .attr("fill", color);
    node.append("text")
      .attr("x", item => item.type === "event" ? radius(item) + 8 : 0)
      .attr("y", item => item.type === "event" ? 4 : radius(item) + 16)
      .attr("text-anchor", item => item.type === "event" ? "start" : "middle")
      .attr("fill", "#2a2118")
      .attr("font-size", 13)
      .text(item => `${item.label} (${item.count})`);
    svg.on("click", () => {
      selected = null;
      paint(node, link);
      window.dispatchEvent(new CustomEvent("library-select", { detail: {} }));
    });
    paint(node, link);
  });

function endId(value) {
  return value && value.id ? value.id : value;
}

function paint(node, link) {
  const near = new Set();
  if (selected) {
    near.add(selected.id);
    link.data().forEach(item => {
      const source = endId(item.source);
      const target = endId(item.target);
      if (source === selected.id || target === selected.id) {
        near.add(source);
        near.add(target);
      }
    });
  }
  node.classed("is-dim", item => selected && !near.has(item.id));
  node.classed("is-on", item => selected && item.id === selected.id);
  link.classed("is-on", item => {
    if (!selected) return false;
    return endId(item.source) === selected.id || endId(item.target) === selected.id;
  });
}
