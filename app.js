let map;
let userMarker;
let sellerLayer;
let currentLocation = null;

const $ = (id) => document.getElementById(id);

function initMap() {
  map = L.map("map", { zoomControl: false }).setView([9.5916, 76.5222], 10);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  sellerLayer = L.layerGroup().addTo(map);
}

function setStatus(text) { $("locationStatus").textContent = text; }

function distanceKm(a, b, c, d) {
  const R = 6371, p = Math.PI / 180;
  const x = (c-a)*p, y = (d-b)*p;
  const q = Math.sin(x/2)**2 + Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1-q));
}

function icon(className) {
  return L.divIcon({ className: "", html: `<div class="${className}"></div>`, iconSize:[30,30], iconAnchor:[15,28] });
}

function escapeHtml(s="") {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function renderResults(places, source="OPENSTREETMAP") {
  places.sort((a,b)=>a.distance-b.distance);
  $("resultCount").textContent = `${places.length} spot${places.length===1?"":"s"}`;
  $("sourceLabel").textContent = source;
  sellerLayer.clearLayers();

  if (!places.length) {
    $("results").innerHTML = `<div class="empty-state"><div class="empty-icon">🥥</div><strong>No coco signals</strong><p>Try increasing the search radius or use the demo area.</p></div>`;
    return;
  }

  $("results").innerHTML = places.map((p,i)=>`
    <article class="result-card" data-index="${i}">
      <div class="result-top">
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <div class="result-type">${escapeHtml(p.type)}</div>
        </div>
        <span class="distance">${p.distance < 1 ? Math.round(p.distance*1000)+" m" : p.distance.toFixed(1)+" km"}</span>
      </div>
      ${p.address ? `<div class="result-address">${escapeHtml(p.address)}</div>` : ""}
      <a class="go-link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}">GET DIRECTIONS ↗</a>
    </article>
  `).join("");

  places.forEach((p,i)=>{
    const marker = L.marker([p.lat,p.lon], {icon: icon("pin")}).addTo(sellerLayer);
    marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.type)}</small>`);
    marker.on("click", ()=>document.querySelector(`[data-index="${i}"]`)?.scrollIntoView({behavior:"smooth",block:"nearest"}));
    p.marker = marker;
  });

  document.querySelectorAll(".result-card").forEach(card=>{
    card.addEventListener("click", e=>{
      if(e.target.closest("a")) return;
      const p = places[Number(card.dataset.index)];
      map.setView([p.lat,p.lon], Math.max(map.getZoom(),15), {animate:true});
      p.marker.openPopup();
    });
  });
}

function demoPlaces(lat, lon) {
  const offsets = [
    [0.006,0.008,"Coco Corner","Fresh coconut seller"],
    [-0.008,0.004,"Thenga Kada","Fruit & coconut shop"],
    [0.011,-0.012,"Green Basket","Greengrocer / local produce"],
    [-0.014,-0.009,"Nadan Market","Local market"],
    [0.018,0.015,"Beachside Coco","Coconut & fresh juice"]
  ];
  return offsets.map(([dy,dx,name,type])=>{
    const pLat=lat+dy,pLon=lon+dx;
    return {lat:pLat,lon:pLon,name,type,address:"Demo result — replace with live map data",distance:distanceKm(lat,lon,pLat,pLon)};
  });
}

async function searchNearby(lat, lon) {
  const radius = Number($("radius").value);
  // OSM has no universal "coconut seller" tag, so we search a useful set of
  // produce/marketplace tags plus names/descriptions containing coconut terms.
  const query = `[out:json][timeout:15];
(
  nwr(around:${radius},${lat},${lon})["name"~"coconut|thenga|tenga|narial|coco",i];
  nwr(around:${radius},${lat},${lon})["shop"~"greengrocer|convenience|supermarket|farm",i];
  nwr(around:${radius},${lat},${lon})["amenity"~"marketplace|cafe|restaurant|fast_food",i];
);
out center tags;`;

  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);
  try {
    const res = await fetch(url, {headers:{"Accept":"application/json"}});
    if(!res.ok) throw new Error("Overpass unavailable");
    const data = await res.json();
    const seen = new Set();
    const places = data.elements.map(el=>{
      const pLat=el.lat ?? el.center?.lat, pLon=el.lon ?? el.center?.lon;
      if(pLat==null || pLon==null) return null;
      const t=el.tags||{};
      const name=t.name || "Unnamed local seller";
      const key=`${name}|${pLat.toFixed(5)}|${pLon.toFixed(5)}`;
      if(seen.has(key)) return null; seen.add(key);
      const type=t.shop || t.amenity || (/(coconut|thenga|tenga|narial|coco)/i.test(name) ? "coconut seller" : "local market");
      const address=[t["addr:street"],t["addr:place"],t["addr:city"]].filter(Boolean).join(", ");
      return {lat:pLat,lon:pLon,name,type,address,distance:distanceKm(lat,lon,pLat,pLon)};
    }).filter(Boolean)
      .sort((a,b)=>a.distance-b.distance)
      .slice(0,40);
    renderResults(places, "LIVE / OPENSTREETMAP");
    if (!places.length) {
      setStatus("No matching OSM places nearby. Try a larger radius.");
    } else {
      setStatus(`Found ${places.length} nearby place${places.length===1?"":"s"}.`);
    }
  } catch(err) {
    renderResults(demoPlaces(lat,lon), "DEMO / API OFFLINE");
    setStatus("Live map search was unavailable, so demo results are shown.");
  }
}

function useLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by this browser.");
    return;
  }
  setStatus("Requesting your location…");
  $("locateBtn").disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos=>{
      $("locateBtn").disabled=false;
      currentLocation={lat:pos.coords.latitude,lon:pos.coords.longitude};
      map.setView([currentLocation.lat,currentLocation.lon],15);
      if(userMarker) map.removeLayer(userMarker);
      userMarker=L.marker([currentLocation.lat,currentLocation.lon],{icon:icon("user-pin")})
        .addTo(map).bindPopup("<strong>You are here</strong>").openPopup();
      $("refreshBtn").disabled=false;
      $("finder").scrollIntoView({behavior:"smooth",block:"start"});
      searchNearby(currentLocation.lat,currentLocation.lon);
    },
    err=>{
      $("locateBtn").disabled=false;
      const messages={1:"Location permission was denied. Please allow it in your browser settings.",2:"Your location could not be determined.",3:"Location request timed out."};
      setStatus(messages[err.code]||"Could not get your location.");
    },
    {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
  );
}

$("locateBtn").addEventListener("click", useLocation);
$("refreshBtn").addEventListener("click", ()=>currentLocation && searchNearby(currentLocation.lat,currentLocation.lon));
$("radius").addEventListener("change", ()=>currentLocation && searchNearby(currentLocation.lat,currentLocation.lon));
$("demoBtn").addEventListener("click", ()=>{
  // Demo center is Kochi, Kerala. Change this to any starting point for demos.
  const lat=9.9312,lon=76.2673;
  currentLocation={lat,lon};
  map.setView([lat,lon],13);
  if(userMarker) map.removeLayer(userMarker);
  userMarker=L.marker([lat,lon],{icon:icon("user-pin")}).addTo(map).bindPopup("<strong>Demo location — Kochi</strong>").openPopup();
  $("refreshBtn").disabled=false;
  renderResults(demoPlaces(lat,lon),"DEMO AREA");
  setStatus("Demo mode: Kochi, Kerala. Tap Use My Location for live nearby results.");
  $("finder").scrollIntoView({behavior:"smooth",block:"start"});
});

initMap();
