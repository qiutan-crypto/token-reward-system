export type UserRole = 'parent' | 'child'

export type EntryType = 'earn' | 'redeem' | 'adjustment'

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled'

export interface Family {
  id: string
  name: string
  owner_user_id: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  family_id: string | null
  role: UserRole
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Child {
  id: string
  family_id: string
  name: string
  avatar_url: string | null
  user_id: string | null
  pin_code: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface BehaviorRule {
  id: string
  family_id: string
  title: string
  description: string | null
  category: string | null
  token_value: number
  active: boolean
  created_at: string
}

export interface TokenLedger {
  id: string
  family_id: string
  child_id: string
  rule_id: string | null
  entry_type: EntryType
  token_amount: number
  note: string | null
  awarded_by: string | null
  occurred_at: string
  year_month: string
  created_at: string
}

export interface RewardCatalog {
  id: string
  family_id: string
  title: string
  description: string | null
  image_url: string | null
  token_cost: number
  stock_qty: number | null
  active: boolean
  created_at: string
}

export interface RewardRedemption {
  id: string
  family_id: string
  child_id: string
  reward_id: string
  token_cost: number
  status: RedemptionStatus
  approved_by: string | null
  redeemed_at: string
  created_at: string
  reward?: RewardCatalog
  child?: Child
}

export interface ChildBalance {
  child_id: string
  current_balance: number
}
