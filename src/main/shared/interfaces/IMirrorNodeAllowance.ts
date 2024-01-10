export interface IMirrorNodeAllowance {
  amount: number;
  amount_granted: number;
  owner: string;
  spender: string;
  timestamp: {
    from: string;
    to: string | null;
  };
}
