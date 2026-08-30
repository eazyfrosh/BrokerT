/** ISO 3166-1 country names used by the registration and delivery forms. */
export const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Bahrain", "Bangladesh", "Belgium", "Brazil", "Bulgaria",
  "Canada", "Chile", "China", "Colombia", "Croatia", "Cyprus", "Czechia", "Denmark", "Egypt",
  "Estonia", "Finland", "France", "Germany", "Ghana", "Greece", "Hong Kong SAR", "Hungary",
  "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kenya",
  "Kuwait", "Latvia", "Lithuania", "Luxembourg", "Malaysia", "Malta", "Mexico", "Morocco",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman", "Pakistan", "Peru", "Philippines",
  "Poland", "Portugal", "Qatar", "Romania", "Saudi Arabia", "Serbia", "Singapore", "Slovakia",
  "Slovenia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland",
  "Taiwan", "Tanzania", "Thailand", "Türkiye", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Vietnam", "Zambia", "Zimbabwe",
] as const;

export type Country = (typeof COUNTRIES)[number];
