require('dotenv').config()
const mongoose = require('mongoose')
const { Route, User } = require('../models/index')

// NOTE: Stations with coords { lat: 0, lng: 0 } are real stops with unverified GPS.
// They represent physical locations that exist but whose coordinates have not yet been
// confirmed in the field. Do NOT treat these as data errors.
// The map skips markers for these; the station list still displays them by name.

const routes = [
  {
    routeId: 'ALEX-MICRO-01',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'المندرة ↔ محطة مصر',
    nameEn: 'Mandara ↔ Mahattet Masr',
    origin: {
      nameAr: 'المندرة',
      nameEn: 'Mandara',
      coords: { lat: 31.2785, lng: 30.0142 },
    },
    destination: {
      nameAr: 'محطة مصر',
      nameEn: 'Mahattet Masr',
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    stations: [
      { order: 1,  nameAr: 'المندرة',      nameEn: 'Mandara',       coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 2,  nameAr: 'العصافرة',     nameEn: 'Asafra',        coords: { lat: 0, lng: 0 } },
      { order: 3,  nameAr: 'ميامي',        nameEn: 'Miami',         coords: { lat: 31.2681, lng: 29.9994 } },
      { order: 4,  nameAr: 'سيدي بشر',    nameEn: 'Sidi Bishr',    coords: { lat: 0, lng: 0 } },
      { order: 5,  nameAr: 'جليم',         nameEn: 'Gleem',         coords: { lat: 0, lng: 0 } },
      { order: 6,  nameAr: 'رشدي',         nameEn: 'Rushdy',        coords: { lat: 0, lng: 0 } },
      { order: 7,  nameAr: 'سيدي جابر',   nameEn: 'Sidi Gaber',    coords: { lat: 31.2201, lng: 29.9386 } },
      { order: 8,  nameAr: 'كليوباترا',   nameEn: 'Cleopatra',     coords: { lat: 0, lng: 0 } },
      { order: 9,  nameAr: 'الإبراهيمية', nameEn: 'Ibrahimeyya',   coords: { lat: 0, lng: 0 } },
      { order: 10, nameAr: 'الشاطبي',     nameEn: 'Shatby',        coords: { lat: 0, lng: 0 } },
      { order: 11, nameAr: 'باب شرقي',    nameEn: 'Bab Sharqi',    coords: { lat: 0, lng: 0 } },
      { order: 12, nameAr: 'محطة مصر',    nameEn: 'Mahattet Masr', coords: { lat: 31.1956, lng: 29.9021 } },
    ],
    fare: { min: 8.50, max: 10.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '05:00', end: '23:59' },
    peakHours: ['08:00-10:00', '14:30-17:30'],
    direction: 'bidirectional',
    tips: [
      'التعريفة زادت تقريباً 15% بعد زيادة أسعار الوقود في مارس 2026',
      'في وقت الزحمة الصبح خد المشروع من المندرة مش سيدي بشر',
      'شارع أبو قير بيتزنق جداً من سيدي جابر لكليوباترا في أوقات الذروة',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-02',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'محطة مصر ↔ الكيلو 21',
    nameEn: 'Mahattet Masr ↔ Kilo 21',
    origin: {
      nameAr: 'محطة مصر',
      nameEn: 'Mahattet Masr',
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: 'الكيلو 21',
      nameEn: 'Kilo 21',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1, nameAr: 'محطة مصر',      nameEn: 'Mahattet Masr',       coords: { lat: 31.1956, lng: 29.9021 } },
      { order: 2, nameAr: 'كوبري محرم بك', nameEn: 'Moharram Bey Bridge', coords: { lat: 0, lng: 0 } },
      { order: 3, nameAr: 'الطريق الدولي', nameEn: 'International Road',  coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'كوبري الدخيلة', nameEn: 'Dekheila Bridge',     coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'البيطاش',       nameEn: 'Bitash',              coords: { lat: 0, lng: 0 } },
      { order: 6, nameAr: 'الهانوفيل',     nameEn: 'Hanoveel',            coords: { lat: 0, lng: 0 } },
      { order: 7, nameAr: 'الكيلو 21',     nameEn: 'Kilo 21',             coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 12.00, max: 14.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '06:00', end: '23:00' },
    peakHours: ['07:00-09:30', '15:00-18:00'],
    direction: 'bidirectional',
    tips: [
      'اتأكد من السواق إنه رايح الكيلو 21 مش بس الهانوفيل',
      'الطريق الدولي بيتزنق قوي جنب كوبري الدخيلة',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-03',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'سيدي جابر ↔ أبو قير',
    nameEn: 'Sidi Gaber ↔ Abu Qir',
    origin: {
      nameAr: 'سيدي جابر',
      nameEn: 'Sidi Gaber',
      coords: { lat: 31.2201, lng: 29.9386 },
    },
    destination: {
      nameAr: 'أبو قير',
      nameEn: 'Abu Qir',
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      { order: 1,  nameAr: 'سيدي جابر',       nameEn: 'Sidi Gaber',         coords: { lat: 31.2201, lng: 29.9386 } },
      { order: 2,  nameAr: 'طريق الحرية',     nameEn: 'Tariq El Horreya',   coords: { lat: 0, lng: 0 } },
      { order: 3,  nameAr: 'فيكتوريا',        nameEn: 'Victoria',           coords: { lat: 0, lng: 0 } },
      { order: 4,  nameAr: 'شارع مالك حفني', nameEn: 'Malek Hafny St',     coords: { lat: 0, lng: 0 } },
      { order: 5,  nameAr: 'محمد نجيب',       nameEn: 'Mohamed Naguib',     coords: { lat: 0, lng: 0 } },
      { order: 6,  nameAr: 'جمال عبد الناصر',nameEn: 'Gamal Abdel Nasser', coords: { lat: 0, lng: 0 } },
      { order: 7,  nameAr: 'سيدي بشر',       nameEn: 'Sidi Bishr',         coords: { lat: 0, lng: 0 } },
      { order: 8,  nameAr: 'المندرة',         nameEn: 'Mandara',            coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 9,  nameAr: 'المنتزه',         nameEn: 'Montazah',           coords: { lat: 31.2858, lng: 30.0123 } },
      { order: 10, nameAr: 'الإصلاح',        nameEn: 'El Eslah',           coords: { lat: 0, lng: 0 } },
      { order: 11, nameAr: 'طوسون',          nameEn: 'Tawson',             coords: { lat: 0, lng: 0 } },
      { order: 12, nameAr: 'أبو قير',        nameEn: 'Abu Qir',            coords: { lat: 31.3101, lng: 30.0612 } },
    ],
    fare: { min: 9.50, max: 11.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '05:00', end: '23:30' },
    peakHours: ['07:30-09:30', '14:00-17:00'],
    direction: 'bidirectional',
    tips: [
      'خط بديل لقطار أبو قير المتوقف منذ مارس 2024',
      'زحمة شديدة جداً عند فيكتوريا في الصبح',
      'الخط ده بيمر على طريق الحرية مش الكورنيش',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-04',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'الموقف الجديد ↔ أبو قير',
    nameEn: 'New Terminal ↔ Abu Qir',
    origin: {
      nameAr: 'الموقف الجديد',
      nameEn: 'New Terminal',
      coords: { lat: 0, lng: 0 },
    },
    destination: {
      nameAr: 'أبو قير',
      nameEn: 'Abu Qir',
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      { order: 1,  nameAr: 'الموقف الجديد',    nameEn: 'New Terminal',       coords: { lat: 0, lng: 0 } },
      { order: 2,  nameAr: 'طريق قناة السويس', nameEn: 'Suez Canal Rd',      coords: { lat: 0, lng: 0 } },
      { order: 3,  nameAr: 'طريق الحرية',      nameEn: 'Tariq El Horreya',   coords: { lat: 0, lng: 0 } },
      { order: 4,  nameAr: 'فيكتوريا',         nameEn: 'Victoria',           coords: { lat: 0, lng: 0 } },
      { order: 5,  nameAr: 'شارع مالك حفني',  nameEn: 'Malek Hafny St',     coords: { lat: 0, lng: 0 } },
      { order: 6,  nameAr: 'محمد نجيب',        nameEn: 'Mohamed Naguib',     coords: { lat: 0, lng: 0 } },
      { order: 7,  nameAr: 'جمال عبد الناصر', nameEn: 'Gamal Abdel Nasser', coords: { lat: 0, lng: 0 } },
      { order: 8,  nameAr: 'سيدي بشر',        nameEn: 'Sidi Bishr',         coords: { lat: 0, lng: 0 } },
      { order: 9,  nameAr: 'المندرة',          nameEn: 'Mandara',            coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 10, nameAr: 'المنتزه',          nameEn: 'Montazah',           coords: { lat: 31.2858, lng: 30.0123 } },
      { order: 11, nameAr: 'الإصلاح',         nameEn: 'El Eslah',           coords: { lat: 0, lng: 0 } },
      { order: 12, nameAr: 'طوسون',           nameEn: 'Tawson',             coords: { lat: 0, lng: 0 } },
      { order: 13, nameAr: 'أبو قير',         nameEn: 'Abu Qir',            coords: { lat: 31.3101, lng: 30.0612 } },
    ],
    fare: { min: 11.00, max: 13.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '06:00', end: '22:00' },
    peakHours: ['07:00-09:00', '15:00-18:00'],
    direction: 'bidirectional',
    tips: [
      'خط بديل لقطار أبو قير المتوقف منذ مارس 2024',
      'مناسب للقادمين من القاهرة — الموقف الجديد قريب من الطريق الصحراوي',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-05',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'سيدي بشر ↔ أبو قير',
    nameEn: 'Sidi Bishr ↔ Abu Qir',
    origin: {
      nameAr: 'سيدي بشر',
      nameEn: 'Sidi Bishr',
      coords: { lat: 0, lng: 0 },
    },
    destination: {
      nameAr: 'أبو قير',
      nameEn: 'Abu Qir',
      coords: { lat: 31.3101, lng: 30.0612 },
    },
    stations: [
      { order: 1, nameAr: 'سيدي بشر',       nameEn: 'Sidi Bishr',      coords: { lat: 0, lng: 0 } },
      { order: 2, nameAr: 'شارع مالك حفني', nameEn: 'Malek Hafny St',  coords: { lat: 0, lng: 0 } },
      { order: 3, nameAr: 'مبرة العصافرة',  nameEn: 'Mabarra Asafra',  coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'جمال عبد الناصر',nameEn: 'Gamal Abdel Nasser', coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'المندرة',        nameEn: 'Mandara',         coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 6, nameAr: 'المنتزه',        nameEn: 'Montazah',        coords: { lat: 31.2858, lng: 30.0123 } },
      { order: 7, nameAr: 'المعمورة',       nameEn: 'Maamoura',        coords: { lat: 0, lng: 0 } },
      { order: 8, nameAr: 'أبو قير',       nameEn: 'Abu Qir',         coords: { lat: 31.3101, lng: 30.0612 } },
    ],
    fare: { min: 7.00, max: 8.50, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '05:30', end: '23:00' },
    peakHours: ['08:00-10:00', '14:00-16:30'],
    direction: 'bidirectional',
    tips: [
      'خط بديل لقطار أبو قير المتوقف منذ مارس 2024',
      'بيمر على مبرة العصافرة — مفيد لو رايح المستشفى',
      'ممكن السواق يطلب أكتر من التعريفة بالليل — لو حصل كده اتصل على 114',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-06',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'المندرة ↔ الطابية',
    nameEn: 'Mandara ↔ El Tabia',
    origin: {
      nameAr: 'المندرة',
      nameEn: 'Mandara',
      coords: { lat: 31.2785, lng: 30.0142 },
    },
    destination: {
      nameAr: 'الطابية',
      nameEn: 'El Tabia',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1, nameAr: 'المندرة',          nameEn: 'Mandara',        coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 2, nameAr: 'المنتزه',          nameEn: 'Montazah',       coords: { lat: 31.2858, lng: 30.0123 } },
      { order: 3, nameAr: 'الإصلاح',         nameEn: 'El Eslah',       coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'المعمورة البلد',   nameEn: 'Maamoura Balad', coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'الشرطة العسكرية', nameEn: 'Military Police', coords: { lat: 0, lng: 0 } },
      { order: 6, nameAr: 'الكلية البحرية',  nameEn: 'Naval Academy',  coords: { lat: 0, lng: 0 } },
      { order: 7, nameAr: 'طريق رشيد',       nameEn: 'Rosetta Rd',     coords: { lat: 0, lng: 0 } },
      { order: 8, nameAr: 'الطابية',         nameEn: 'El Tabia',       coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 6.50, max: 8.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '06:00', end: '22:30' },
    peakHours: ['07:30-09:30', '15:00-17:30'],
    direction: 'bidirectional',
    tips: [
      'خط بديل لقطار أبو قير المتوقف منذ مارس 2024',
      'تجنب الركوب في الجو الممطر — طريق رشيد بيتجمع فيه المياه',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-07',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'فيكتوريا ↔ الطابية',
    nameEn: 'Victoria ↔ El Tabia',
    origin: {
      nameAr: 'فيكتوريا',
      nameEn: 'Victoria',
      coords: { lat: 0, lng: 0 },
    },
    destination: {
      nameAr: 'الطابية',
      nameEn: 'El Tabia',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1,  nameAr: 'فيكتوريا',         nameEn: 'Victoria',       coords: { lat: 0, lng: 0 } },
      { order: 2,  nameAr: 'مالك حفني',        nameEn: 'Malek Hafny',    coords: { lat: 0, lng: 0 } },
      { order: 3,  nameAr: 'محمد نجيب',        nameEn: 'Mohamed Naguib', coords: { lat: 0, lng: 0 } },
      { order: 4,  nameAr: 'المندرة',          nameEn: 'Mandara',        coords: { lat: 31.2785, lng: 30.0142 } },
      { order: 5,  nameAr: 'المنتزه',          nameEn: 'Montazah',       coords: { lat: 31.2858, lng: 30.0123 } },
      { order: 6,  nameAr: 'الإصلاح',         nameEn: 'El Eslah',       coords: { lat: 0, lng: 0 } },
      { order: 7,  nameAr: 'المعمورة البلد',   nameEn: 'Maamoura Balad', coords: { lat: 0, lng: 0 } },
      { order: 8,  nameAr: 'الشرطة العسكرية', nameEn: 'Military Police', coords: { lat: 0, lng: 0 } },
      { order: 9,  nameAr: 'الكلية البحرية',  nameEn: 'Naval Academy',  coords: { lat: 0, lng: 0 } },
      { order: 10, nameAr: 'طريق رشيد',       nameEn: 'Rosetta Rd',     coords: { lat: 0, lng: 0 } },
      { order: 11, nameAr: 'الطابية',         nameEn: 'El Tabia',       coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 8.00, max: 10.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '05:30', end: '23:00' },
    peakHours: ['08:00-10:00', '14:00-17:00'],
    direction: 'bidirectional',
    tips: [
      'خط بديل لقطار أبو قير المتوقف منذ مارس 2024',
      'اركب من محطة فيكتوريا نفسها عشان تضمن مكان',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-08',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'محطة مصر ↔ برج العرب الجديد (صحراوي)',
    nameEn: 'Mahattet Masr ↔ New Borg El Arab (Desert Rd)',
    origin: {
      nameAr: 'محطة مصر',
      nameEn: 'Mahattet Masr',
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: 'برج العرب الجديد',
      nameEn: 'New Borg El Arab',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1, nameAr: 'محطة مصر',         nameEn: 'Mahattet Masr',        coords: { lat: 31.1956, lng: 29.9021 } },
      { order: 2, nameAr: 'كوبري محرم بك',    nameEn: 'Moharram Bey Bridge',  coords: { lat: 0, lng: 0 } },
      { order: 3, nameAr: 'الطريق الصحراوي',  nameEn: 'Desert Rd',            coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'كوبري مرغم',       nameEn: 'Morghom Bridge',       coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'كوبري العامرية',   nameEn: 'Amreya Bridge',        coords: { lat: 0, lng: 0 } },
      { order: 6, nameAr: 'طريق كافوري',      nameEn: 'Kafouri Rd',           coords: { lat: 0, lng: 0 } },
      { order: 7, nameAr: 'استاد برج العرب',  nameEn: 'Borg El Arab Stadium', coords: { lat: 0, lng: 0 } },
      { order: 8, nameAr: 'صينية الهوارية',   nameEn: 'Senyyet El Hawaryia',  coords: { lat: 0, lng: 0 } },
      { order: 9, nameAr: 'برج العرب الجديد', nameEn: 'New Borg El Arab',     coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 15.00, max: 18.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '06:00', end: '22:00' },
    peakHours: ['07:30-09:30', '15:30-18:00'],
    direction: 'bidirectional',
    tips: [
      'ادفع الأجرة للسواق في أول الرحلة',
      'الطريق الصحراوي سريع لكن في الزحمة بيتأخر عند كوبري مرغم',
      'الخط ده بيخدم العمال في منطقة برج العرب الصناعية',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-09',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'محطة مصر ↔ برج العرب الجديد (ساحلي)',
    nameEn: 'Mahattet Masr ↔ New Borg El Arab (Coastal Rd)',
    origin: {
      nameAr: 'محطة مصر',
      nameEn: 'Mahattet Masr',
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: 'برج العرب الجديد',
      nameEn: 'New Borg El Arab',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1, nameAr: 'محطة مصر',         nameEn: 'Mahattet Masr',    coords: { lat: 31.1956, lng: 29.9021 } },
      { order: 2, nameAr: 'القباري',           nameEn: 'El Qabbary',       coords: { lat: 0, lng: 0 } },
      { order: 3, nameAr: 'المكس',             nameEn: 'El Max',           coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'الدخيلة',          nameEn: 'Dekheila',         coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'الكيلو 21',        nameEn: 'Kilo 21',          coords: { lat: 0, lng: 0 } },
      { order: 6, nameAr: 'الطريق الساحلي',   nameEn: 'Coastal Rd',       coords: { lat: 0, lng: 0 } },
      { order: 7, nameAr: 'سيدي كرير',        nameEn: 'Sidi Kerir',       coords: { lat: 0, lng: 0 } },
      { order: 8, nameAr: 'البرج القديم',      nameEn: 'Old Borg',         coords: { lat: 0, lng: 0 } },
      { order: 9, nameAr: 'برج العرب الجديد', nameEn: 'New Borg El Arab', coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 16.00, max: 18.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '06:00', end: '21:30' },
    peakHours: ['08:00-10:00', '16:00-18:30'],
    direction: 'bidirectional',
    tips: [
      'أبطأ من خط الصحراوي في الصيف بسبب زحمة الشواطئ على الطريق الساحلي',
      'بيمر على سيدي كرير — تقدر تنزل هناك لو رايح الشاطئ',
    ],
    verified: true,
    isActive: true,
  },
  {
    routeId: 'ALEX-MICRO-10',
    type: 'microbus',
    localName: 'مشروع',
    nameAr: 'محطة مصر ↔ برج العرب الجديد (صحراوي مختصر)',
    nameEn: 'Mahattet Masr ↔ New Borg El Arab (Short Desert)',
    origin: {
      nameAr: 'محطة مصر',
      nameEn: 'Mahattet Masr',
      coords: { lat: 31.1956, lng: 29.9021 },
    },
    destination: {
      nameAr: 'برج العرب الجديد',
      nameEn: 'New Borg El Arab',
      coords: { lat: 0, lng: 0 },
    },
    stations: [
      { order: 1, nameAr: 'محطة مصر',         nameEn: 'Mahattet Masr',       coords: { lat: 31.1956, lng: 29.9021 } },
      { order: 2, nameAr: 'كوبري محرم بك',    nameEn: 'Moharram Bey Bridge', coords: { lat: 0, lng: 0 } },
      { order: 3, nameAr: 'الطريق الصحراوي',  nameEn: 'Desert Rd',           coords: { lat: 0, lng: 0 } },
      { order: 4, nameAr: 'كوبري مرغم',       nameEn: 'Morghom Bridge',      coords: { lat: 0, lng: 0 } },
      { order: 5, nameAr: 'العامرية',         nameEn: 'Amreya',              coords: { lat: 0, lng: 0 } },
      { order: 6, nameAr: 'صينية الهوارية',   nameEn: 'Senyyet El Hawaryia', coords: { lat: 0, lng: 0 } },
      { order: 7, nameAr: 'برج العرب الجديد', nameEn: 'New Borg El Arab',    coords: { lat: 0, lng: 0 } },
    ],
    fare: { min: 14.00, max: 16.00, currency: 'EGP', lastVerified: '2026-03' },
    operatingHours: { start: '05:00', end: '23:00' },
    peakHours: ['07:00-09:30', '14:30-17:30'],
    direction: 'bidirectional',
    tips: [
      'الخط ده بيخدم العمال في منطقة العامرية الصناعية',
      'أرخص من خطي كافوري والساحلي',
    ],
    verified: true,
    isActive: true,
  },
]

async function connectDB() {
  console.log('جاري الاتصال بقاعدة البيانات...')
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('تم الاتصال بقاعدة البيانات بنجاح ✓')
}

async function seed() {
  try {
    await connectDB()

    console.log('جاري حذف البيانات القديمة...')
    await Route.deleteMany({})
    await User.deleteMany({ role: 'admin' })

    console.log('جاري إضافة الخطوط...')
    const result = await Route.insertMany(routes)
    console.log(`تم إضافة ${result.length} خط بنجاح ✓`)

    // Pre-save hook in User model automatically hashes the password
    await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL,
      passwordHash: process.env.ADMIN_PASSWORD,
      role: 'admin',
    })
    console.log('تم إنشاء المستخدم الإداري ✓')

    await mongoose.disconnect()
    console.log('تم الانتهاء من الـ Seed بنجاح 🎉')
  } catch (err) {
    console.error('خطأ أثناء الـ Seed:', err)
    process.exit(1)
  }
}

seed()
