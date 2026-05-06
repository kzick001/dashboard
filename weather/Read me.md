### Hardcoded Configuration & Endpoints
**Target Location**
 * **City:** St. Louis Park, MN
 * **Latitude:** 44.9483
 * **Longitude:** -93.3666
**Primary Data Endpoints**
 * **Cloudflare Worker (Master Telemetry):** https://kzick-weather.askozicki.workers.dev/
 * **National Weather Service (Active Alerts):** https://api.weather.gov/alerts/active?point=44.9483,-93.3666
 * **Iowa Environmental Mesonet (Radar Raster Tiles):** https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913-m{OFFSET}m/{z}/{x}/{y}.png *(Note: {OFFSET} accepts values in 5-minute increments, e.g., 05, 10, 15... up to 50).*
Raw Data Examples:
{
  "data": {
    "timelines": [
      {
        "timestep": "1d",
        "intervals": [
          {
            "startTime": "2026-05-05T11:00:00Z",
            "values": {
              "cloudCover": 100,
              "dewPoint": 27,
              "humidity": 80,
              "precipitationIntensity": 0,
              "precipitationProbability": 0,
              "precipitationType": 0,
              "pressureSurfaceLevel": 29.04,
              "sunriseTime": "2026-05-05T10:57:00Z",
              "sunsetTime": "2026-05-06T01:23:00Z",
              "temperature": 50.94,
              "temperatureApparent": 50.9,
              "temperatureMax": 50.94,
              "temperatureMin": 31.41,
              "uvIndex": 2,
              "visibility": 9.9,
              "weatherCode": 1000,
              "windDirection": 339,
              "windGust": 22.3,
              "windSpeed": 14.6
            }
          }
        ]
      },
      {
        "timestep": "1h",
        "intervals": [
          {
            "startTime": "2026-05-05T17:00:00Z",
            "values": {
              "cloudCover": 43.02,
              "dewPoint": 16.4,
              "humidity": 29,
              "precipitationIntensity": 0,
              "precipitationProbability": 0,
              "precipitationType": 0,
              "pressureSurfaceLevel": 28.9,
              "temperature": 49.15,
              "temperatureApparent": 49.2,
              "temperatureMax": 49.15,
              "temperatureMin": 49.15,
              "uvIndex": 2,
              "visibility": 9.9,
              "weatherCode": 1101,
              "windDirection": 283,
              "windGust": 21.6,
              "windSpeed": 10.2
            }
          }
        ]
      },
      {
        "timestep": "current",
        "intervals": [
          {
            "startTime": "2026-05-05T17:20:00Z",
            "values": {
              "cloudCover": 55.16,
              "dewPoint": 16.7,
              "humidity": 28,
              "precipitationIntensity": 0,
              "precipitationProbability": 0,
              "precipitationType": 0,
              "pressureSurfaceLevel": 28.93,
              "temperature": 48.76,
              "temperatureApparent": 48.8,
              "temperatureMax": 48.76,
              "temperatureMin": 48.76,
              "uvIndex": 2,
              "visibility": 8.7,
              "weatherCode": 1101,
              "windDirection": 276,
              "windGust": 21.5,
              "windSpeed": 12
            }
          }
        ]
      }
    ]
  },
  "_meta": {
    "source": "KV_CACHE_HIT",
    "cache_key": "weather_slp_mn_v3_1",
    "timestamp": 1778001619938
  }
}
