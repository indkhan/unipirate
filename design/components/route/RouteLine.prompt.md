RouteLine — THE signature element: the student's journey as a transit line with a pulsing "you are here" marker. Use once per screen, prominently; keep everything around it quiet.

```jsx
<RouteLine currentIndex={1} orientation="horizontal" />
<RouteLine currentIndex={2} orientation="vertical"
  stations={[{label:'Eligibility', sub:'Done 02 May 2026'}, 'APS', {label:'Applications', sub:'3 of 5 sent'}, 'Visa', 'Germany']} />
```

Horizontal ≥768px, vertical on mobile. Done stations are Route Blue with a check — never green. The marker pulse is the system's only looping motion and disables itself under prefers-reduced-motion.
