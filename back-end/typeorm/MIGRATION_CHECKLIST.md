# Migration Testing Checklist

Before merging a migration PR:

- [ ] Run `pnpm test` - succeeds
- [ ] Test on dev environment with existing data
- [ ] Verify no data loss after migration