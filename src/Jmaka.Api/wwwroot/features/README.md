# Frontend Features Layout

This folder contains feature-oriented frontend assets that can be integrated separately.

## Shared dependency
- `shared/core.js` must be loaded before all image tools.

## Tool scripts (load order in this app)
1. `shared/core.js`
2. `split/tool.js`
3. `split3/tool.js`
4. `oknofix/tool.js`
5. `oknoscale/tool.js`
6. `crop/tool.js`
7. `edit/tool.js`
8. `videoedit/tool.js`

## Video Edit styles
- `videoedit/style.css`

## Notes
- `tool.js` files for image tools are sliced from legacy `app.js` and rely on the shared globals from `shared/core.js`.
- For standalone integration, include only the modal markup for the required tool and the scripts listed in that tool README.
