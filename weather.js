// Real weather where the phone is, from Open-Meteo (free, no key). Opt-in: the
// location only ever goes from this phone to Open-Meteo, never onto the fob.

const ON = 'fobling.weather.on';
const CACHE = 'fobling.weather.cache';
const FRESH_MS = 30 * 60 * 1000;

function get(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}

export const weatherOn = () => get(ON) === '1';
export const setWeatherOn = (on) => set(ON, on ? '1' : '0');

export const WEATHER = {
  clear: { icon: '☀️', label: 'Clear' },
  hot: { icon: '😎', label: 'Hot' },
  cloudy: { icon: '☁️', label: 'Cloudy' },
  rain: { icon: '🌧️', label: 'Rain' },
  storm: { icon: '⛈️', label: 'Storm' },
  snow: { icon: '❄️', label: 'Snow day' },
  fog: { icon: '🌫️', label: 'Fog' },
};

/** WMO weather code + temperature (°C) + wind (km/h) → what the window shows. */
export function classify(code, temp, wind) {
  let kind = 'clear';
  if (code >= 95) kind = 'storm';
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) kind = 'snow';
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) kind = 'rain';
  else if (code === 45 || code === 48) kind = 'fog';
  else if (code === 2 || code === 3) kind = 'cloudy';
  if (kind === 'clear' && temp >= 28) kind = 'hot';
  return { kind, windy: wind >= 30, temp: Math.round(temp) };
}

/** 0 = new moon, 0.5 = full moon. */
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14); // a new moon
  const days = (date.getTime() - known) / 86400000;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

function cached() {
  try {
    const c = JSON.parse(get(CACHE) || 'null');
    if (c && Date.now() - c.at < FRESH_MS) return c;
  } catch {
    /* ignore */
  }
  return null;
}

function where() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude.toFixed(2), lon: p.coords.longitude.toFixed(2) }),
      reject,
      { enableHighAccuracy: false, timeout: 12000, maximumAge: FRESH_MS },
    );
  });
}

/**
 * The current weather, or null if it's off or unavailable.
 * `ask` turns it on (and may show the browser's location prompt).
 */
export async function getWeather({ ask = false } = {}) {
  if (!weatherOn() && !ask) return null;
  const c = cached();
  if (c) return c.w;
  try {
    const { lat, lon } = await where();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`weather ${r.status}`);
    const cur = (await r.json()).current;
    const w = classify(cur.weather_code, cur.temperature_2m, cur.wind_speed_10m);
    setWeatherOn(true);
    set(CACHE, JSON.stringify({ at: Date.now(), w }));
    return w;
  } catch (e) {
    if (ask && e && e.code === 1) setWeatherOn(false); // permission denied
    throw e;
  }
}
