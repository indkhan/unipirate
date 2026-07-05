ChecklistItem — a tappable task row (48px+). Checked state is Route Blue with strikethrough — never green.

```jsx
<ChecklistItem
  label="Get your transcripts attested"
  detail="Original + 2 copies, attested by your university."
  deadline={<DeadlineChip date="15 Jul 2026" daysLeft={12} />}
  verified={<VerifiedStamp source="APS India checklist" date="12 Jun 2026" />}
  checked={false} onToggle={fn}
/>
```

Compose deadline/verified via slots so the chips stay consistent everywhere.
