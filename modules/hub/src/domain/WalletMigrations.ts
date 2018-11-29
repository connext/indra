export interface Migration {
  migrationId: number
  migrationName: string
  appliedAt?: string
}
export interface WalletMigrations {
  applied: Array<Migration>,
  unapplied: Array<Migration>
}