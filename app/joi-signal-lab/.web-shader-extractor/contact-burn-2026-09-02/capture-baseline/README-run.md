# Run

From this directory:

```bash
python3 -m http.server 4173
```

- Animated replay: `http://127.0.0.1:4173/`
- Fixed initial state: `http://127.0.0.1:4173/?p=0`
- Fixed middle state: `http://127.0.0.1:4173/?p=0.45`
- Fixed final state: `http://127.0.0.1:4173/?p=1`

The page uses a deterministic noise seed so fixed-state comparisons are repeatable.
