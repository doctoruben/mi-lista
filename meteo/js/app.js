// 📅 Fecha mañana
const hoy = new Date();
const manana = new Date(hoy);
manana.setDate(hoy.getDate() + 1);

document.getElementById('fechaManana').textContent =
  manana.toLocaleDateString();

// 🌍 Datos guardados
let municipios = JSON.parse(localStorage.getItem("meteo")) || [];

// 🌦️ Obtener clima
async function obtenerTiempo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`;

  const res = await fetch(url);
  const data = await res.json();

  return {
    tMax: data.daily.temperature_2m_max[1],
    tMin: data.daily.temperature_2m_min[1],
    prob: data.daily.precipitation_probability_max[1],
    code: data.daily.weathercode[1]
  };
}

// Emoji clima
function getEmoji(code) {
  if (code < 3) return "☀️";
  if (code < 50) return "⛅";
  if (code < 70) return "🌧️";
  return "⛈️";
}

// 🔔 Alerta lluvia
function hayAlerta(prob) {
  return prob >= 70;
}

// 🧱 Render
async function render() {
  const cont = document.getElementById("lista");
  cont.innerHTML = "Cargando...";

  let html = "";

  for (let i = 0; i < municipios.length; i++) {
    const m = municipios[i];
    const c = await obtenerTiempo(m.lat, m.lon);

    html += `
    <div class="weather-card">
      <button class="btn-delete" onclick="eliminar(${i})">✖</button>

      <div class="is-flex is-justify-content-between">
        <div>
          <div class="city-name">
            ${m.nombre}
            ${hayAlerta(c.prob) ? "🔔" : ""}
          </div>

          <div class="temp-info">
            <span class="rain">💧 ${c.prob}%</span> |
            ↑ ${c.tMax}° ↓ ${c.tMin}°
          </div>
        </div>

        <div style="font-size:30px">${getEmoji(c.code)}</div>
      </div>
    </div>
    `;
  }

  cont.innerHTML = html || "No hay ciudades";
}

// ➕ Abrir modal
document.getElementById("btnPlus").onclick = () => {
  document.getElementById("modalAdd").classList.add("is-active");
};

// ❌ cerrar
function cerrar() {
  document.getElementById("modalAdd").classList.remove("is-active");
  document.getElementById("res").innerHTML = "";
  document.getElementById("inBusca").value = "";
}

// 🔎 buscar ciudades
async function buscar(v) {
  if (v.length < 3) return;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${v}&count=5&language=es`;

  const res = await fetch(url);
  const data = await res.json();

  const cont = document.getElementById("res");
  cont.innerHTML = "";

  if (data.results) {
    data.results.forEach(l => {
      const div = document.createElement("div");
      div.style = "padding:10px;background:#eee;margin-top:5px;cursor:pointer;color:black;";
      div.innerHTML = `<strong>${l.name}</strong> (${l.admin1 || ""})`;

      div.onclick = () => guardar(l);

      cont.appendChild(div);
    });
  }
}

// 💾 guardar
function guardar(l) {
  municipios.push({
    nombre: l.name,
    lat: l.latitude,
    lon: l.longitude
  });

  localStorage.setItem("meteo", JSON.stringify(municipios));
  cerrar();
  render();
}

// 🗑️ eliminar
function eliminar(i) {
  municipios.splice(i, 1);
  localStorage.setItem("meteo", JSON.stringify(municipios));
  render();
}

// 🚀 init
render();
