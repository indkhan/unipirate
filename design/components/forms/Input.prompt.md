Input — labeled text field; 48px tall, 16px font (prevents Android focus-zoom), hairline border, blue focus ring.

```jsx
<Input label="Passport number" mono required hint="Exactly as printed on the photo page." />
<Input label="Email" type="email" error="Enter an address with an @ — like you@example.com." />
```

`mono` switches the value to the document-data voice (dates, IDs). Errors are Danger red and say what to do; hints are secondary ink. Required = "· required" suffix, never a bare asterisk.
