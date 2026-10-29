// Tageswetter über Open-Meteo (kostenlos, kein Key). Standort auf ~10 km gerundet.
export function getWeather() {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const lat = pos.coords.latitude.toFixed(1), lon = pos.coords.longitude.toFixed(1);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        '&daily=apparent_temperature_max,apparent_temperature_min,precipitation_probability_max&timezone=auto&forecast_days=1';
      const d = (await (await fetch(url)).json()).daily;
      const min = d.apparent_temperature_min[0], max = d.apparent_temperature_max[0];
      resolve({ min, max, temp: (min + max) / 2, rain: d.precipitation_probability_max[0] });
    } catch (e) { reject(e); }
  }, reject, { timeout: 10000, maximumAge: 3600000 }));
}
