// 📅 Fecha mañana
const hoy = new Date();
const manana = new Date(hoy);
manana.setDate(hoy.getDate() + 1);

document.getElementById('fechaManana').textContent = manana.toLocaleDateString();

// 🌍 Datos guardados
let municipios = JSON.parse(localStorage.getItem("meteo")) || [];

// 🌦️ Obtener clima — con manejo de errores
async function obtenerTiempo(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return {
      tMax: Math.round(data.daily.temperature_2m_max[1]),
      tMin: Math.round(data.daily.temperature_2m_min[1]),
      prob: data.daily.precipitation_probability_max[1],
      code: data.daily.weathercode[1],
      error: false
    };
  } catch (e) {
    return { error: true };
  }
}

// Emoji clima
function getEmoji(code) {
  if (code < 3)  return "☀️";
  if (code < 50) return "⛅";
  if (code < 70) return "🌧️";
  return "⛈️";
}

// 🧱 Render — llamadas en paralelo con Promise.all
async function render() {
  const cont = document.getElementById("lista");
  cont.innerHTML = "<p style='text-align:center; opacity:0.5;'>Actualizando...</p>";

  if (municipios.length === 0) {
    cont.innerHTML = "<p style='text-align:center; opacity:0.5; margin-top:20px;'>No hay ciudades añadidas</p>";
    return;
  }

  // FIX: lanzar todas las peticiones en paralelo en vez de una a una
  const resultados = await Promise.all(
    municipios.map(m => obtenerTiempo(m.lat, m.lon))
  );

  const html = municipios.map((m, i) => {
    const c = resultados[i];

    if (c.error) {
      return `
      <div class="weather-card">
        <div class="weather-icon">⚠️</div>
        <div class="weather-content">
          <span class="city-name">${m.nombre}</span>
          <div class="temp-info">
            <span style="opacity:0.5; font-size:13px;">Error al cargar</span>
          </div>
        </div>
        <button class="btn-delete" onclick="eliminar(${i})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
    }

    return `
    <div class="weather-card">
      <div class="weather-icon">
        ${getEmoji(c.code)}
      </div>
      <div class="weather-content">
        <span class="city-name">
          ${m.nombre} ${c.prob >= 70 ? "🔔" : ""}
        </span>
        <div class="temp-info">
          <span class="rain">${c.prob}%</span>
          <span>${c.tMax}° / ${c.tMin}°</span>
        </div>
      </div>
      <button class="btn-delete" onclick="eliminar(${i})">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  }).join("");

  cont.innerHTML = html;
}

// ➕ Abrir modal
document.getElementById("btnPlus").onclick = () => {
  document.getElementById("modalAdd").classList.add("is-active");
};

// ❌ Cerrar
function cerrar() {
  document.getElementById("modalAdd").classList.remove("is-active");
  document.getElementById("res").innerHTML = "";
  document.getElementById("inBusca").value = "";
}

// 🔎 Buscar ciudades — con debounce para evitar peticiones en cada tecla
let _buscarTimer = null;
function buscar(v) {
  clearTimeout(_buscarTimer);
  if (v.length < 3) {
    document.getElementById("res").innerHTML = "";
    return;
  }
  _buscarTimer = setTimeout(() => _buscarEjecutar(v), 350);
}

async function _buscarEjecutar(v) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=5&language=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cont = document.getElementById("res");
    cont.innerHTML = "";

    if (data.results) {
      data.results.forEach(l => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.innerHTML = `<strong>${l.name}</strong> <small>${l.admin1 || ""}</small>`;
        div.onclick = () => guardar(l);
        cont.appendChild(div);
      });
    }
  } catch (e) {
    document.getElementById("res").innerHTML =
      "<p style='color:#f87171; font-size:13px; margin-top:8px;'>Error al buscar. Comprueba tu conexión.</p>";
  }
}

// FIX: comprobar duplicados antes de guardar
function guardar(l) {
  const yaExiste = municipios.some(
    m => m.lat === l.latitude && m.lon === l.longitude
  );
  if (yaExiste) {
    cerrar();
    return;
  }
  municipios.push({ nombre: l.name, lat: l.latitude, lon: l.longitude });
  localStorage.setItem("meteo", JSON.stringify(municipios));
  cerrar();
  render();
}

function eliminar(i) {
  municipios.splice(i, 1);
  localStorage.setItem("meteo", JSON.stringify(municipios));
  render();
}

render();
