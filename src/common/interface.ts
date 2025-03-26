export interface IProduct {
  id: 'string';
  title: 'string';
  approximatePrice: 0;
  priceDifference: 0;
  note?: string;
}

export interface IReportsDTO {
  products: IProduct[];
  reportStatusCallbackUrl?: 'string';
  note?: string;
  sources: string[];
  matchByAi: true;
}

export interface IReportsResponse {
  id: string;
  reportStatus: string;
  createdAtUtc: string;
  completedAtUtc: string;
  note?: string;
  reportStatusCallbackUrl?: string;
}
