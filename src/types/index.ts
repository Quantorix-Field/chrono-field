/* ============================================
   SHARED TYPES
   Single source of truth for data shapes used
   across the entire app.
   ============================================ */

export interface Location {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lng: number;
  timezone?: string;
}

export type WeatherCondition =
  | 'clear'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'haze'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherHour {
  temperature: number | null;
  cloudcover: number;
  precipitation: number;
  visibility: number;
  humidity: number;
  windspeed: number;
  winddirection: number;
  condition: WeatherCondition;
  conditionLabel: string;
  hasData: boolean;
}

export interface WeatherHourlyRaw {
  time: string[];
  temperature_2m: (number | null)[];
  cloudcover: (number | null)[];
  precipitation: (number | null)[];
  weathercode: (number | null)[];
  visibility: (number | null)[];
  relative_humidity_2m: (number | null)[];
  windspeed_10m: (number | null)[];
  winddirection_10m: (number | null)[];
}

export interface SunPosition {
  altitude: number; // radians
  azimuth: number;  // radians
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  civilDawn: Date;
  civilDusk: Date;
  nauticalDawn: Date;
  nauticalDusk: Date;
  astronomicalDawn: Date;
  astronomicalDusk: Date;
}

export interface MoonData {
  phase: number;      // 0 = new, 0.5 = full, 1 = new again
  angle: number;
  fraction: number;   // illuminated fraction 0..1
  altitude: number;
  azimuth: number;
}

export interface DateRange {
  min: string; // ISO date string
  max: string;
}

export interface SkyRenderState {
  sunAltitude: number;
  sunAzimuth: number;
  moonAltitude: number;
  moonAzimuth: number;
  moonPhase: number;
  condition: WeatherCondition;
  cloudcover: number;
  precipitation: number;
  visibility: number;
  windspeed: number;
  winddirection: number;
}

export interface ChronoMoment {
  location: Location;
  date: string;    // YYYY-MM-DD
  minutes: number; // minutes since midnight, 0-1439
}
