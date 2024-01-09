export interface NetworkExchangeRateSetResponse {
  current_rate: ExchangeRate;
  next_rate: ExchangeRate;
  timestamp: string;
}

export interface ExchangeRate {
  cent_equivalent: number;
  expiration_time: number;
  hbar_equivalent: number;
}
