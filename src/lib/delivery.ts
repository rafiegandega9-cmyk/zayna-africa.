const CITY_DELIVERY_FEES_XOF = new Map([
  ["abidjan", 1500],
  ["yamoussoukro", 2000],
  ["bouake", 3000],
  ["san-pedro", 3000],
  ["san pedro", 3000],
]);

export function getDeliveryFeeXof(city: string): number | null {
  const normalizedCity = city.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-CI");
  return CITY_DELIVERY_FEES_XOF.get(normalizedCity) ?? null;
}
