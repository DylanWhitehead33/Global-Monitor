/* Static overlay datasets for the Global Monitoring System map views.
 * All locations are approximate and drawn from publicly reported, widely
 * documented sources (news coverage, FAS, IISS, Wikipedia). Curated to the
 * major/strategic sites — not an exhaustive registry.
 */
"use strict";

/* Publicly reported nuclear-weapons-associated bases and facilities */
const NUCLEAR_SITES = [
  // United States
  { n: "Minot AFB (B-52 / ICBM)", c: "United States", lat: 48.42, lng: -101.34 },
  { n: "Malmstrom AFB (ICBM)", c: "United States", lat: 47.50, lng: -111.18 },
  { n: "F.E. Warren AFB (ICBM)", c: "United States", lat: 41.13, lng: -104.87 },
  { n: "Whiteman AFB (B-2)", c: "United States", lat: 38.73, lng: -93.55 },
  { n: "Barksdale AFB (B-52)", c: "United States", lat: 32.50, lng: -93.66 },
  { n: "NSB Kings Bay (SSBN)", c: "United States", lat: 30.80, lng: -81.52 },
  { n: "NB Kitsap–Bangor (SSBN)", c: "United States", lat: 47.72, lng: -122.71 },
  { n: "Kirtland AFB (storage)", c: "United States", lat: 35.04, lng: -106.55 },
  { n: "Pantex Plant", c: "United States", lat: 35.32, lng: -101.56 },
  // NATO sharing (publicly reported)
  { n: "Incirlik AB", c: "Turkey (US weapons, reported)", lat: 37.00, lng: 35.43 },
  { n: "Aviano AB", c: "Italy (US weapons, reported)", lat: 46.03, lng: 12.60 },
  { n: "Ghedi AB", c: "Italy (US weapons, reported)", lat: 45.43, lng: 10.27 },
  { n: "Büchel AB", c: "Germany (US weapons, reported)", lat: 50.17, lng: 7.06 },
  { n: "Kleine Brogel AB", c: "Belgium (US weapons, reported)", lat: 51.17, lng: 5.47 },
  { n: "Volkel AB", c: "Netherlands (US weapons, reported)", lat: 51.66, lng: 5.70 },
  { n: "RAF Lakenheath (re-equipped, reported)", c: "United Kingdom", lat: 52.41, lng: 0.56 },
  // United Kingdom
  { n: "HMNB Clyde / Faslane (SSBN)", c: "United Kingdom", lat: 56.06, lng: -4.82 },
  { n: "AWE Aldermaston", c: "United Kingdom", lat: 51.37, lng: -1.14 },
  // France
  { n: "Île Longue (SSBN)", c: "France", lat: 48.30, lng: -4.50 },
  { n: "Istres AB (ASMP)", c: "France", lat: 43.52, lng: 4.92 },
  { n: "Avord AB (ASMP)", c: "France", lat: 47.05, lng: 2.63 },
  // Russia
  { n: "Engels-2 AB (bombers)", c: "Russia", lat: 51.48, lng: 46.21 },
  { n: "Ukrainka AB (bombers)", c: "Russia", lat: 51.17, lng: 128.44 },
  { n: "Olenya AB (bombers)", c: "Russia", lat: 68.15, lng: 33.46 },
  { n: "Gadzhiyevo (SSBN)", c: "Russia", lat: 69.25, lng: 33.33 },
  { n: "Vilyuchinsk (SSBN)", c: "Russia", lat: 52.93, lng: 158.40 },
  { n: "Kozelsk (ICBM)", c: "Russia", lat: 54.03, lng: 35.78 },
  { n: "Tatishchevo (ICBM)", c: "Russia", lat: 51.67, lng: 45.60 },
  { n: "Dombarovsky (ICBM)", c: "Russia", lat: 50.80, lng: 59.52 },
  { n: "Sarov (research)", c: "Russia", lat: 54.92, lng: 43.32 },
  // China
  { n: "Yumen silo field (reported)", c: "China", lat: 40.20, lng: 96.30 },
  { n: "Hami silo field (reported)", c: "China", lat: 42.80, lng: 93.50 },
  { n: "Jilantai training area (reported)", c: "China", lat: 39.70, lng: 105.50 },
  { n: "Delingha missile base (reported)", c: "China", lat: 37.37, lng: 97.37 },
  { n: "Longpo, Hainan (SSBN)", c: "China", lat: 18.20, lng: 109.70 },
  { n: "Lop Nur test site", c: "China", lat: 41.50, lng: 88.50 },
  // South Asia / others (publicly reported)
  { n: "Sargodha / PAF Mushaf area", c: "Pakistan", lat: 32.05, lng: 72.67 },
  { n: "Kamra complex", c: "Pakistan", lat: 33.87, lng: 72.40 },
  { n: "Ambala AFS (Rafale)", c: "India", lat: 30.37, lng: 76.77 },
  { n: "INS Varsha area (SSBN, reported)", c: "India", lat: 17.70, lng: 83.30 },
  { n: "Negev Nuclear Research Center (Dimona)", c: "Israel (undeclared)", lat: 31.00, lng: 35.15 },
  { n: "Sdot Micha (reported)", c: "Israel (undeclared)", lat: 31.72, lng: 34.92 },
  { n: "Yongbyon complex", c: "North Korea", lat: 39.80, lng: 125.75 },
  { n: "Punggye-ri test site", c: "North Korea", lat: 41.28, lng: 129.09 },
  { n: "Sohae launch site", c: "North Korea", lat: 39.66, lng: 124.71 },
];

/* Major strategic military bases (curated) */
const MILITARY_BASES = [
  // United States — CONUS & Pacific
  { n: "Naval Station Norfolk (largest naval base)", c: "United States", lat: 36.94, lng: -76.31 },
  { n: "Naval Base San Diego", c: "United States", lat: 32.68, lng: -117.13 },
  { n: "Joint Base Pearl Harbor–Hickam", c: "United States", lat: 21.35, lng: -157.94 },
  { n: "Fort Liberty (Bragg)", c: "United States", lat: 35.14, lng: -79.00 },
  { n: "Andersen AFB, Guam", c: "United States", lat: 13.58, lng: 144.92 },
  { n: "Naval Base Guam", c: "United States", lat: 13.44, lng: 144.66 },
  // US overseas
  { n: "Ramstein AB", c: "US / Germany", lat: 49.44, lng: 7.60 },
  { n: "Diego Garcia", c: "US–UK / Indian Ocean", lat: -7.32, lng: 72.42 },
  { n: "Kadena AB, Okinawa", c: "US / Japan", lat: 26.35, lng: 127.77 },
  { n: "Fleet Activities Yokosuka (7th Fleet)", c: "US / Japan", lat: 35.29, lng: 139.67 },
  { n: "Misawa AB", c: "US / Japan", lat: 40.70, lng: 141.37 },
  { n: "Camp Humphreys", c: "US / South Korea", lat: 36.96, lng: 127.03 },
  { n: "Osan AB", c: "US / South Korea", lat: 37.09, lng: 127.03 },
  { n: "Al Udeid AB (CENTCOM forward)", c: "US / Qatar", lat: 25.12, lng: 51.32 },
  { n: "NSA Bahrain (5th Fleet)", c: "US / Bahrain", lat: 26.21, lng: 50.61 },
  { n: "Ali Al Salem AB", c: "US / Kuwait", lat: 29.35, lng: 47.52 },
  { n: "Naval Station Rota", c: "US / Spain", lat: 36.62, lng: -6.35 },
  { n: "NSA Souda Bay, Crete", c: "US / Greece", lat: 35.49, lng: 24.15 },
  { n: "Camp Lemonnier", c: "US / Djibouti", lat: 11.54, lng: 43.15 },
  { n: "Pituffik SB (Thule)", c: "US / Greenland", lat: 76.53, lng: -68.70 },
  { n: "Guantanamo Bay NS", c: "US / Cuba", lat: 19.90, lng: -75.10 },
  // United Kingdom
  { n: "RAF Akrotiri, Cyprus", c: "United Kingdom", lat: 34.59, lng: 32.99 },
  { n: "British Forces Gibraltar", c: "United Kingdom", lat: 36.14, lng: -5.35 },
  { n: "HMNB Portsmouth", c: "United Kingdom", lat: 50.80, lng: -1.11 },
  // France
  { n: "French Forces Djibouti", c: "France", lat: 11.55, lng: 43.16 },
  { n: "Toulon Naval Base", c: "France", lat: 43.11, lng: 5.93 },
  // Russia
  { n: "Khmeimim AB, Syria", c: "Russia", lat: 35.40, lng: 35.95 },
  { n: "Tartus Naval Facility, Syria", c: "Russia", lat: 34.90, lng: 35.87 },
  { n: "Kaliningrad garrison (Baltic Fleet)", c: "Russia", lat: 54.70, lng: 20.50 },
  { n: "Sevastopol (Black Sea Fleet)", c: "Russia", lat: 44.62, lng: 33.53 },
  { n: "Severomorsk (Northern Fleet)", c: "Russia", lat: 69.07, lng: 33.42 },
  { n: "Vladivostok (Pacific Fleet)", c: "Russia", lat: 43.10, lng: 131.90 },
  // China
  { n: "PLA Support Base, Djibouti", c: "China", lat: 11.59, lng: 43.06 },
  { n: "Woody Island, Paracels", c: "China (disputed)", lat: 16.83, lng: 112.34 },
  { n: "Fiery Cross Reef, Spratlys", c: "China (disputed)", lat: 9.55, lng: 112.89 },
  { n: "Mischief Reef, Spratlys", c: "China (disputed)", lat: 9.90, lng: 115.53 },
  { n: "Ream Naval Base (Chinese presence, reported)", c: "Cambodia", lat: 10.50, lng: 103.60 },
  { n: "Yulin Naval Base, Hainan", c: "China", lat: 18.22, lng: 109.55 },
  // Others
  { n: "INS Baaz, Andaman & Nicobar", c: "India", lat: 11.65, lng: 92.72 },
  { n: "Anadyr / Arctic garrisons", c: "Russia", lat: 64.73, lng: 177.50 },
  { n: "Nagurskoye AB (Arctic)", c: "Russia", lat: 80.80, lng: 47.66 },
];

/* Major maritime trade choke points */
const CHOKE_POINTS = [
  { n: "Strait of Hormuz", note: "~20% of global oil transit", lat: 26.57, lng: 56.25 },
  { n: "Suez Canal", note: "~12% of global trade", lat: 30.45, lng: 32.35 },
  { n: "Strait of Malacca", note: "busiest shipping lane, Asia–Europe", lat: 2.30, lng: 101.10 },
  { n: "Bab el-Mandeb", note: "Red Sea gateway", lat: 12.58, lng: 43.33 },
  { n: "Bosphorus / Turkish Straits", note: "Black Sea grain & oil", lat: 41.12, lng: 29.06 },
  { n: "Strait of Gibraltar", note: "Mediterranean–Atlantic", lat: 35.95, lng: -5.60 },
  { n: "Panama Canal", note: "Atlantic–Pacific shortcut", lat: 9.08, lng: -79.68 },
  { n: "Danish Straits", note: "Baltic exit route", lat: 55.70, lng: 10.80 },
  { n: "Taiwan Strait", note: "major container corridor", lat: 24.50, lng: 119.50 },
  { n: "Strait of Dover", note: "world's busiest strait", lat: 51.00, lng: 1.40 },
  { n: "Cape of Good Hope", note: "Suez alternative route", lat: -34.36, lng: 18.47 },
  { n: "Sunda Strait", note: "Malacca alternative", lat: -5.92, lng: 105.87 },
  { n: "Lombok Strait", note: "deep-draft Malacca alternative", lat: -8.75, lng: 115.73 },
  { n: "Kerch Strait", note: "Sea of Azov access", lat: 45.25, lng: 36.60 },
  { n: "St. Lawrence Seaway", note: "Great Lakes access", lat: 46.90, lng: -70.90 },
];
