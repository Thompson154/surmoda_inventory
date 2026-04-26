import type {
  CreateSalePayload,
  ListSalesFilters,
  PaginatedSales as PaginatedSalesContract,
  PaymentMethod as PaymentMethodContract,
  SaleDTO as SaleDTOContract,
  SaleItemDTO as SaleItemDTOContract,
  SalesDashboard as SalesDashboardContract,
  SaleWithItems as SaleWithItemsContract,
} from '@surmoda/contracts';

export type PaymentMethod = PaymentMethodContract;
export type SaleDTO = SaleDTOContract;
export type SaleItemDTO = SaleItemDTOContract;
export type SaleWithItems = SaleWithItemsContract;
export type PaginatedSales = PaginatedSalesContract;
export type SalesDashboard = SalesDashboardContract;
export type CreateSaleDTO = CreateSalePayload;
export type ListSalesFiltersDTO = ListSalesFilters;

export interface ListSalesQuery {
  page: number;
  pageSize: number;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}
