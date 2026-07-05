DeadlineChip — the ONLY place Signal Amber appears. Mono date, uppercase label, square amber tick.

```jsx
<DeadlineChip date="15 Jul 2026" daysLeft={12} />
<DeadlineChip date="01 Jun 2026" daysLeft={-4} />  // flips to danger "Overdue"
```

≤14 days adds a countdown. Overdue switches the whole chip to Danger red — amber means "time pressure", red means "missed".
