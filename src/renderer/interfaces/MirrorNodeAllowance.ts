export interface MirrorNodeAllowance {
  amount: number;
  amount_granted: number;
  owner: string;
  spender: string;
  timestamp: {
    from: string;
    to: string | null;
  };
}
