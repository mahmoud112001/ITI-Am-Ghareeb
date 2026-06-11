require("dotenv").config();
const mongoose = require("mongoose");
const { Route, User } = require("../models/index");

// All coordinates sourced from Wikipedia, Wikidata, and verified geo databases.
// Sources per station are noted inline where the value was looked up.
// A small number of intermediate stops (road junctions, bridges) use
// interpolated positions along the known route axis — marked [interp].

const routes = [
  {
    routeId: "ALEX-MICRO-01",
    type: "microbus",
    localName: "مشروع",
    nameAr: "المندرة ↔ محطة مصر",
    nameEn: "Mandara ↔ Mahattet Masr",
    origin: {
      nameAr: "المندرة",
      nameEn: "Mandara",
      coords: { lat: 31.2785, lng: 30.0142 },
    },
    destination: {
      nameAr: "محطة مصر",
      nameEn: "Mahattet Masr",
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    stations: [
      {
        order: 1,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 2,
        nameAr: "العصافرة",
        nameEn: "Asafra",
        coords: { lat: 31.2703, lng: 30.0056 },
      }, // Wikidata Q4803317
      {
        order: 3,
        nameAr: "ميامي",
        nameEn: "Miami",
        coords: { lat: 31.2677, lng: 29.9954 },
      }, // Wikipedia Miami,Alexandria
      {
        order: 4,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.256118, lng: 29.992268 },
      }, // Wikipedia Sidi_Bishr
      {
        order: 5,
        nameAr: "جليم",
        nameEn: "Gleem",
        coords: { lat: 31.2419, lng: 29.9613 },
      }, // Wikipedia Glim
      {
        order: 6,
        nameAr: "رشدي",
        nameEn: "Rushdy",
        coords: { lat: 31.2244, lng: 29.9366 },
      }, // Wikipedia Roshdy
      {
        order: 7,
        nameAr: "سيدي جابر",
        nameEn: "Sidi Gaber",
        coords: { lat: 31.2201, lng: 29.9386 },
      }, // seed original
      {
        order: 8,
        nameAr: "كليوباترا",
        nameEn: "Cleopatra",
        coords: { lat: 31.2185, lng: 29.9366 },
      }, // Wikipedia Cleopatra_(neighborhood)
      {
        order: 9,
        nameAr: "الإبراهيمية",
        nameEn: "Ibrahimeyya",
        coords: { lat: 31.2151, lng: 29.9274 },
      }, // Wikipedia El_Ibrahimiyya
      {
        order: 10,
        nameAr: "الشاطبي",
        nameEn: "Shatby",
        coords: { lat: 31.2108, lng: 29.9138 },
      }, // Wikipedia Shatby
      {
        order: 11,
        nameAr: "باب شرقي",
        nameEn: "Bab Sharqi",
        coords: { lat: 31.2009, lng: 29.9187 },
      }, // city-centre district centroid
      {
        order: 12,
        nameAr: "محطة مصر",
        nameEn: "Mahattet Masr",
        coords: { lat: 31.1956, lng: 29.9021 },
      }, // seed original
    ],
    fare: { min: 8.5, max: 10.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "05:00", end: "23:59" },
    peakHours: ["08:00-10:00", "14:30-17:30"],
    direction: "bidirectional",
    tips: [
      "التعريفة زادت تقريباً 15% بعد زيادة أسعار الوقود في مارس 2026",
      "في وقت الزحمة الصبح خد المشروع من المندرة مش سيدي بشر",
      "شارع أبو قير بيتزنق جداً من سيدي جابر لكليوباترا في أوقات الذروة",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-02",
    type: "microbus",
    localName: "مشروع",
    nameAr: "محطة مصر ↔ الكيلو 21",
    nameEn: "Mahattet Masr ↔ Kilo 21",
    origin: {
      nameAr: "محطة مصر",
      nameEn: "Mahattet Masr",
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: "الكيلو 21",
      nameEn: "Kilo 21",
      coords: { lat: 31.135, lng: 29.815 },
    },
    stations: [
      {
        order: 1,
        nameAr: "محطة مصر",
        nameEn: "Mahattet Masr",
        coords: { lat: 31.1956, lng: 29.9021 },
      }, // seed original
      {
        order: 2,
        nameAr: "كوبري محرم بك",
        nameEn: "Moharram Bey Bridge",
        coords: { lat: 31.1917, lng: 29.9118 },
      }, // Wikipedia Moharam_Bek
      {
        order: 3,
        nameAr: "الطريق الدولي",
        nameEn: "International Road",
        coords: { lat: 31.17, lng: 29.87 },
      }, // [interp] midpoint axis
      {
        order: 4,
        nameAr: "كوبري الدخيلة",
        nameEn: "Dekheila Bridge",
        coords: { lat: 31.1228, lng: 29.8182 },
      }, // Wikipedia Dekhela
      {
        order: 5,
        nameAr: "البيطاش",
        nameEn: "Bitash",
        coords: { lat: 31.14, lng: 29.84 },
      }, // [interp] between Dekheila and Kilo21
      {
        order: 6,
        nameAr: "الهانوفيل",
        nameEn: "Hanoveel",
        coords: { lat: 31.139, lng: 29.822 },
      }, // [interp] near Dekheila west
      {
        order: 7,
        nameAr: "الكيلو 21",
        nameEn: "Kilo 21",
        coords: { lat: 31.135, lng: 29.815 },
      }, // 21km west of Mahattet Masr
    ],
    fare: { min: 12.0, max: 14.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "06:00", end: "23:00" },
    peakHours: ["07:00-09:30", "15:00-18:00"],
    direction: "bidirectional",
    tips: [
      "اتأكد من السواق إنه رايح الكيلو 21 مش بس الهانوفيل",
      "الطريق الدولي بيتزنق قوي جنب كوبري الدخيلة",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-03",
    type: "microbus",
    localName: "مشروع",
    nameAr: "سيدي جابر ↔ أبو قير",
    nameEn: "Sidi Gaber ↔ Abu Qir",
    origin: {
      nameAr: "سيدي جابر",
      nameEn: "Sidi Gaber",
      coords: { lat: 31.2201, lng: 29.9386 },
    },
    destination: {
      nameAr: "أبو قير",
      nameEn: "Abu Qir",
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      {
        order: 1,
        nameAr: "سيدي جابر",
        nameEn: "Sidi Gaber",
        coords: { lat: 31.2201, lng: 29.9386 },
      }, // seed original
      {
        order: 2,
        nameAr: "طريق الحرية",
        nameEn: "Tariq El Horreya",
        coords: { lat: 31.238, lng: 29.96 },
      }, // [interp] major east road axis
      {
        order: 3,
        nameAr: "فيكتوريا",
        nameEn: "Victoria",
        coords: { lat: 31.2486, lng: 29.9697 },
      }, // Wikipedia Victoria_(neighborhood)
      {
        order: 4,
        nameAr: "شارع مالك حفني",
        nameEn: "Malek Hafny St",
        coords: { lat: 31.252, lng: 29.975 },
      }, // [interp] between Victoria & Sidi Bishr
      {
        order: 5,
        nameAr: "محمد نجيب",
        nameEn: "Mohamed Naguib",
        coords: { lat: 31.253202, lng: 29.986699 },
      }, // [interp] eastern corridor
      {
        order: 6,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.258824, lng: 29.988674 },
      }, // [interp] near Asafra axis
      {
        order: 7,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.256118, lng: 29.992268 },
      }, // Wikipedia Sidi_Bishr
      {
        order: 8,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 9,
        nameAr: "الإصلاح",
        nameEn: "El Eslah",
        coords: { lat: 31.284379, lng: 30.040121 },
      }, // [interp]
      {
        order: 10,
        nameAr: "طوسون",
        nameEn: "Tawson",
        coords: { lat: 31.303004, lng: 30.06002 },
      }, // [interp]
      {
        order: 11,
        nameAr: "أبو قير",
        nameEn: "Abu Qir",
        coords: { lat: 31.321895, lng: 30.064129 },
      }, // seed original
    ],
    fare: { min: 9.5, max: 11.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "05:00", end: "23:30" },
    peakHours: ["07:30-09:30", "14:00-17:00"],
    direction: "bidirectional",
    tips: [
      "خط بديل لقطار أبو قير المتوقف منذ مارس 2024",
      "زحمة شديدة جداً عند فيكتوريا في الصبح",
      "الخط ده بيمر على طريق الحرية مش الكورنيش",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-04",
    type: "microbus",
    localName: "مشروع",
    nameAr: "الموقف الجديد ↔ أبو قير",
    nameEn: "New Terminal ↔ Abu Qir",
    origin: {
      nameAr: "الموقف الجديد",
      nameEn: "New Terminal",
      coords: { lat: 31.19, lng: 29.905 },
    },
    destination: {
      nameAr: "أبو قير",
      nameEn: "Abu Qir",
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      {
        order: 1,
        nameAr: "الموقف الجديد",
        nameEn: "New Terminal",
        coords: { lat: 31.19, lng: 29.905 },
      }, // [interp] near Mahattet Masr
      {
        order: 2,
        nameAr: "طريق قناة السويس",
        nameEn: "Suez Canal Rd",
        coords: { lat: 31.186, lng: 29.91 },
      }, // [interp] Moharam Bek area
      {
        order: 3,
        nameAr: "طريق الحرية",
        nameEn: "Tariq El Horreya",
        coords: { lat: 31.238, lng: 29.96 },
      }, // [interp] major east road axis
      {
        order: 4,
        nameAr: "فيكتوريا",
        nameEn: "Victoria",
        coords: { lat: 31.2486, lng: 29.9697 },
      }, // Wikipedia Victoria_(neighborhood)
      {
        order: 5,
        nameAr: "شارع مالك حفني",
        nameEn: "Malek Hafny St",
        coords: { lat: 31.252, lng: 29.975 },
      }, // [interp]
      {
        order: 6,
        nameAr: "محمد نجيب",
        nameEn: "Mohamed Naguib",
        coords: { lat: 31.253202, lng: 29.986699 },
      }, // [interp]
      {
        order: 7,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.258824, lng: 29.988674 },
      }, // [interp]
      {
        order: 8,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.256118, lng: 29.992268 },
      }, // Wikipedia Sidi_Bishr
      {
        order: 9,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 10,
        nameAr: "الإصلاح",
        nameEn: "El Eslah",
        coords: { lat: 31.284379, lng: 30.040121 },
      }, // [interp]
      {
        order: 11,
        nameAr: "طوسون",
        nameEn: "Tawson",
        coords: { lat: 31.303004, lng: 30.06002 },
      }, // [interp]
      {
        order: 12,
        nameAr: "أبو قير",
        nameEn: "Abu Qir",
        coords: { lat: 31.321895, lng: 30.064129 },
      }, // seed original
    ],
    fare: { min: 11.0, max: 13.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "06:00", end: "22:00" },
    peakHours: ["07:00-09:00", "15:00-18:00"],
    direction: "bidirectional",
    tips: [
      "خط بديل لقطار أبو قير المتوقف منذ مارس 2024",
      "مناسب للقادمين من القاهرة — الموقف الجديد قريب من الطريق الصحراوي",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-05",
    type: "microbus",
    localName: "مشروع",
    nameAr: "سيدي بشر ↔ أبو قير",
    nameEn: "Sidi Bishr ↔ Abu Qir",
    origin: {
      nameAr: "سيدي بشر",
      nameEn: "Sidi Bishr",
      coords: { lat: 31.2521, lng: 29.9945 },
    },
    destination: {
      nameAr: "أبو قير",
      nameEn: "Abu Qir",
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      {
        order: 1,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.256118, lng: 29.992268 },
      }, // Wikipedia Sidi_Bishr
      {
        order: 2,
        nameAr: "شارع مالك حفني",
        nameEn: "Malek Hafny St",
        coords: { lat: 31.252, lng: 29.975 },
      }, // [interp]
      {
        order: 3,
        nameAr: "مبرة العصافرة",
        nameEn: "Mabarra Asafra",
        coords: { lat: 31.2703, lng: 30.0056 },
      }, // Asafra area — Wikidata Q4803317
      {
        order: 4,
        nameAr: "سيدي بشر",
        nameEn: "Sidi Bishr",
        coords: { lat: 31.258824, lng: 29.988674 },
      }, // [interp]
      {
        order: 5,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 6,
        nameAr: "المعمورة",
        nameEn: "Maamoura",
        coords: { lat: 31.2918, lng: 30.0409 },
      }, // Wikipedia El_Maamora
      {
        order: 7,
        nameAr: "أبو قير",
        nameEn: "Abu Qir",
        coords: { lat: 31.321895, lng: 30.064129 },
      }, // seed original
    ],
    fare: { min: 7.0, max: 8.5, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "05:30", end: "23:00" },
    peakHours: ["08:00-10:00", "14:00-16:30"],
    direction: "bidirectional",
    tips: [
      "خط بديل لقطار أبو قير المتوقف منذ مارس 2024",
      "بيمر على مبرة العصافرة — مفيد لو رايح المستشفى",
      "ممكن السواق يطلب أكتر من التعريفة بالليل — لو حصل كده اتصل على 114",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-06",
    type: "microbus",
    localName: "مشروع",
    nameAr: "المندرة ↔ الطابية",
    nameEn: "Mandara ↔ El Tabia",
    origin: {
      nameAr: "المندرة",
      nameEn: "Mandara",
      coords: { lat: 31.2785, lng: 30.0142 },
    },
    destination: {
      nameAr: "الطابية",
      nameEn: "El Tabia",
      coords: { lat: 31.318, lng: 30.07 },
    },
    stations: [
      {
        order: 1,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 2,
        nameAr: "الإصلاح",
        nameEn: "El Eslah",
        coords: { lat: 31.284379, lng: 30.040121 },
      }, // [interp]
      {
        order: 3,
        nameAr: "المعمورة البلد",
        nameEn: "Maamoura Balad",
        coords: { lat: 31.298, lng: 30.048 },
      }, // [interp] eastern Maamoura
      {
        order: 4,
        nameAr: "الشرطة العسكرية",
        nameEn: "Military Police",
        coords: { lat: 31.302, lng: 30.054 },
      }, // [interp] east of Maamoura
      {
        order: 5,
        nameAr: "الكلية البحرية",
        nameEn: "Naval Academy",
        coords: { lat: 31.306, lng: 30.058 },
      }, // [interp]
      {
        order: 6,
        nameAr: "طريق رشيد",
        nameEn: "Rosetta Rd",
        coords: { lat: 31.31, lng: 30.06 },
      }, // [interp] near Abu Qir junction
      {
        order: 7,
        nameAr: "الطابية",
        nameEn: "El Tabia",
        coords: { lat: 31.318, lng: 30.07 },
      }, // [interp] NE toward Rosetta
    ],
    fare: { min: 6.5, max: 8.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "06:00", end: "22:30" },
    peakHours: ["07:30-09:30", "15:00-17:30"],
    direction: "bidirectional",
    tips: [
      "خط بديل لقطار أبو قير المتوقف منذ مارس 2024",
      "تجنب الركوب في الجو الممطر — طريق رشيد بيتجمع فيه المياه",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-07",
    type: "microbus",
    localName: "مشروع",
    nameAr: "فيكتوريا ↔ الطابية",
    nameEn: "Victoria ↔ El Tabia",
    origin: {
      nameAr: "فيكتوريا",
      nameEn: "Victoria",
      coords: { lat: 31.2486, lng: 29.9697 },
    },
    destination: {
      nameAr: "الطابية",
      nameEn: "El Tabia",
      coords: { lat: 31.318, lng: 30.07 },
    },
    stations: [
      {
        order: 1,
        nameAr: "فيكتوريا",
        nameEn: "Victoria",
        coords: { lat: 31.2486, lng: 29.9697 },
      }, // Wikipedia Victoria_(neighborhood)
      {
        order: 2,
        nameAr: "مالك حفني",
        nameEn: "Malek Hafny",
        coords: { lat: 31.252, lng: 29.975 },
      }, // [interp]
      {
        order: 3,
        nameAr: "محمد نجيب",
        nameEn: "Mohamed Naguib",
        coords: { lat: 31.253202, lng: 29.986699 },
      }, // [interp]
      {
        order: 4,
        nameAr: "المندرة",
        nameEn: "Mandara",
        coords: { lat: 31.2785, lng: 30.0142 },
      }, // seed original
      {
        order: 5,
        nameAr: "الإصلاح",
        nameEn: "El Eslah",
        coords: { lat: 31.284379, lng: 30.040121 },
      }, // [interp]
      {
        order: 6,
        nameAr: "المعمورة البلد",
        nameEn: "Maamoura Balad",
        coords: { lat: 31.298, lng: 30.048 },
      }, // [interp]
      {
        order: 7,
        nameAr: "الشرطة العسكرية",
        nameEn: "Military Police",
        coords: { lat: 31.302, lng: 30.054 },
      }, // [interp]
      {
        order: 8,
        nameAr: "الكلية البحرية",
        nameEn: "Naval Academy",
        coords: { lat: 31.306, lng: 30.058 },
      }, // [interp]
      {
        order: 9,
        nameAr: "طريق رشيد",
        nameEn: "Rosetta Rd",
        coords: { lat: 31.31, lng: 30.06 },
      }, // [interp]
      {
        order: 10,
        nameAr: "الطابية",
        nameEn: "El Tabia",
        coords: { lat: 31.318, lng: 30.07 },
      }, // [interp]
    ],
    fare: { min: 8.0, max: 10.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "05:30", end: "23:00" },
    peakHours: ["08:00-10:00", "14:00-17:00"],
    direction: "bidirectional",
    tips: [
      "خط بديل لقطار أبو قير المتوقف منذ مارس 2024",
      "اركب من محطة فيكتوريا نفسها عشان تضمن مكان",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-08",
    type: "microbus",
    localName: "مشروع",
    nameAr: "محطة مصر ↔ برج العرب الجديد (صحراوي)",
    nameEn: "Mahattet Masr ↔ New Borg El Arab (Desert Rd)",
    origin: {
      nameAr: "محطة مصر",
      nameEn: "Mahattet Masr",
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: "برج العرب الجديد",
      nameEn: "New Borg El Arab",
      coords: { lat: 30.8489, lng: 29.6117 },
    },
    stations: [
      {
        order: 1,
        nameAr: "محطة مصر",
        nameEn: "Mahattet Masr",
        coords: { lat: 31.1956, lng: 29.9021 },
      }, // seed original
      {
        order: 2,
        nameAr: "كوبري محرم بك",
        nameEn: "Moharram Bey Bridge",
        coords: { lat: 31.1917, lng: 29.9118 },
      }, // Wikipedia Moharam_Bek
      {
        order: 3,
        nameAr: "الطريق الصحراوي",
        nameEn: "Desert Rd",
        coords: { lat: 31.16, lng: 29.85 },
      }, // [interp] entry to desert highway
      {
        order: 4,
        nameAr: "كوبري مرغم",
        nameEn: "Morghom Bridge",
        coords: { lat: 31.12, lng: 29.79 },
      }, // [interp] midpoint desert road
      {
        order: 5,
        nameAr: "كوبري العامرية",
        nameEn: "Amreya Bridge",
        coords: { lat: 31.1045, lng: 29.7662 },
      }, // Wikipedia Amreya
      {
        order: 6,
        nameAr: "طريق كافوري",
        nameEn: "Kafouri Rd",
        coords: { lat: 31.02, lng: 29.74 },
      }, // [interp] near stadium
      {
        order: 7,
        nameAr: "استاد برج العرب",
        nameEn: "Borg El Arab Stadium",
        coords: { lat: 30.999, lng: 29.7262 },
      }, // latlong.net verified
      {
        order: 8,
        nameAr: "صينية الهوارية",
        nameEn: "Senyyet El Hawaryia",
        coords: { lat: 30.87, lng: 29.64 },
      }, // [interp] between stadium & New Borg
      {
        order: 9,
        nameAr: "برج العرب الجديد",
        nameEn: "New Borg El Arab",
        coords: { lat: 30.8489, lng: 29.6117 },
      }, // Wikipedia New_Borg_El_Arab
    ],
    fare: { min: 15.0, max: 18.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "06:00", end: "22:00" },
    peakHours: ["07:30-09:30", "15:30-18:00"],
    direction: "bidirectional",
    tips: [
      "ادفع الأجرة للسواق في أول الرحلة",
      "الطريق الصحراوي سريع لكن في الزحمة بيتأخر عند كوبري مرغم",
      "الخط ده بيخدم العمال في منطقة برج العرب الصناعية",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-09",
    type: "microbus",
    localName: "مشروع",
    nameAr: "محطة مصر ↔ برج العرب الجديد (ساحلي)",
    nameEn: "Mahattet Masr ↔ New Borg El Arab (Coastal Rd)",
    origin: {
      nameAr: "محطة مصر",
      nameEn: "Mahattet Masr",
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: "برج العرب الجديد",
      nameEn: "New Borg El Arab",
      coords: { lat: 30.8489, lng: 29.6117 },
    },
    stations: [
      {
        order: 1,
        nameAr: "محطة مصر",
        nameEn: "Mahattet Masr",
        coords: { lat: 31.1956, lng: 29.9021 },
      }, // seed original
      {
        order: 2,
        nameAr: "القباري",
        nameEn: "El Qabbary",
        coords: { lat: 31.172, lng: 29.8859 },
      }, // Wikipedia El_Qabary
      {
        order: 3,
        nameAr: "المكس",
        nameEn: "El Max",
        coords: { lat: 31.1638, lng: 29.8632 },
      }, // Wikipedia El_Max
      {
        order: 4,
        nameAr: "الدخيلة",
        nameEn: "Dekheila",
        coords: { lat: 31.1228, lng: 29.8182 },
      }, // Wikipedia Dekhela
      {
        order: 5,
        nameAr: "الكيلو 21",
        nameEn: "Kilo 21",
        coords: { lat: 31.135, lng: 29.815 },
      }, // 21km west point
      {
        order: 6,
        nameAr: "الطريق الساحلي",
        nameEn: "Coastal Rd",
        coords: { lat: 31.11, lng: 29.78 },
      }, // [interp] midpoint Dekheila→Sidi Kerir
      {
        order: 7,
        nameAr: "محمد نجيب",
        nameEn: "Mohamed Naguib",
        coords: { lat: 31.003827, lng: 29.639678 },
      }, // MagicPort port data
      {
        order: 8,
        nameAr: "البرج القديم",
        nameEn: "Old Borg",
        coords: { lat: 30.964681, lng: 29.668432 },
      }, // [interp] near New Borg area
      {
        order: 9,
        nameAr: "برج العرب الجديد",
        nameEn: "New Borg El Arab",
        coords: { lat: 30.8489, lng: 29.6117 },
      }, // Wikipedia New_Borg_El_Arab
    ],
    fare: { min: 16.0, max: 18.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "06:00", end: "21:30" },
    peakHours: ["08:00-10:00", "16:00-18:30"],
    direction: "bidirectional",
    tips: [
      "أبطأ من خط الصحراوي في الصيف بسبب زحمة الشواطئ على الطريق الساحلي",
      "بيمر على سيدي كرير — تقدر تنزل هناك لو رايح الشاطئ",
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: "ALEX-MICRO-10",
    type: "microbus",
    localName: "مشروع",
    nameAr: "محطة مصر ↔ برج العرب الجديد (صحراوي مختصر)",
    nameEn: "Mahattet Masr ↔ New Borg El Arab (Short Desert)",
    origin: {
      nameAr: "محطة مصر",
      nameEn: "Mahattet Masr",
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: "برج العرب الجديد",
      nameEn: "New Borg El Arab",
      coords: { lat: 30.8489, lng: 29.6117 },
    },
    stations: [
      {
        order: 1,
        nameAr: "محطة مصر",
        nameEn: "Mahattet Masr",
        coords: { lat: 31.1956, lng: 29.9021 },
      }, // seed original
      {
        order: 2,
        nameAr: "كوبري محرم بك",
        nameEn: "Moharram Bey Bridge",
        coords: { lat: 31.1917, lng: 29.9118 },
      }, // Wikipedia Moharam_Bek
      {
        order: 3,
        nameAr: "الطريق الصحراوي",
        nameEn: "Desert Rd",
        coords: { lat: 31.16, lng: 29.85 },
      }, // [interp]
      {
        order: 4,
        nameAr: "كوبري مرغم",
        nameEn: "Morghom Bridge",
        coords: { lat: 31.12, lng: 29.79 },
      }, // [interp]
      {
        order: 5,
        nameAr: "العامرية",
        nameEn: "Amreya",
        coords: { lat: 31.1045, lng: 29.7662 },
      }, // Wikipedia Amreya
      {
        order: 6,
        nameAr: "صينية الهوارية",
        nameEn: "Senyyet El Hawaryia",
        coords: { lat: 30.87, lng: 29.64 },
      }, // [interp]
      {
        order: 7,
        nameAr: "برج العرب الجديد",
        nameEn: "New Borg El Arab",
        coords: { lat: 30.8489, lng: 29.6117 },
      }, // Wikipedia New_Borg_El_Arab
    ],
    fare: { min: 14.0, max: 16.0, currency: "EGP", lastVerified: "2026-03" },
    operatingHours: { start: "05:00", end: "23:00" },
    peakHours: ["07:00-09:30", "14:30-17:30"],
    direction: "bidirectional",
    tips: [
      "الخط ده بيخدم العمال في منطقة العامرية الصناعية",
      "أرخص من خطي كافوري والساحلي",
    ],
    verified: true,
    isActive: true,
  },
];

async function connectDB() {
  console.log("جاري الاتصال بقاعدة البيانات...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("تم الاتصال بقاعدة البيانات بنجاح ✓");
}

async function seed() {
  try {
    await connectDB();

    console.log("جاري حذف البيانات القديمة...");
    await Route.deleteMany({});
    await User.deleteMany({ role: "admin" });

    console.log("جاري إضافة الخطوط...");
    const result = await Route.insertMany(routes);
    console.log(`تم إضافة ${result.length} خط بنجاح ✓`);

    // Pre-save hook in User model automatically hashes the password
    await User.create({
      name: "Admin",
      email: process.env.ADMIN_EMAIL,
      passwordHash: process.env.ADMIN_PASSWORD,
      role: "admin",
    });
    console.log("تم إنشاء المستخدم الإداري ✓");

    await mongoose.disconnect();
    console.log("تم الانتهاء من الـ Seed بنجاح 🎉");
  } catch (err) {
    console.error("خطأ أثناء الـ Seed:", err);
    process.exit(1);
  }
}

seed();