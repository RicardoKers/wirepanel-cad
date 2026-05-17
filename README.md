# Basic2DCAD

Browser-based 2D CAD for industrial electrical drawings, built with React, TypeScript and Vite.

## Overview

Basic2DCAD is a lightweight web CAD focused on electrical schematics and panel drawings. It runs fully in the browser and stores project data as JSON files handled by the user.

Current highlights:

- 2D drawing tools for lines, potentials, circles, arcs, text and pins
- Selection, move, resize, group and ungroup workflows
- Layers with visibility, locking and active-layer editing
- Grid, snap and pan/zoom navigation
- Electrical potentials with numbering, names, wire size in `mm2` and renumbering
- Pin snapping and automatic potential connections
- Component system with:
  - built-in app library from JSON files
  - project components stored inside the project file
- PDF export with page settings and special text placeholders
- English and Brazilian Portuguese interface
- Built-in HTML help manual available from the app

## Live Site

GitHub Pages:

- `https://ricardokers.github.io/basic2dcad/`

## Tech Stack

- React 18
- TypeScript
- Vite 5
- jsPDF
- i18next + react-i18next

## Project Structure

```text
cad-web/
  public/
    help/                   HTML manuals used by the app
  src/
    components/             React UI panels and canvas
    i18n/                   Language setup and translation resources
    library/
      components/           Built-in component JSON files
      index.ts              Built-in library loader
    utils/                  Geometry, text, markers and component helpers
    App.tsx                 Main application state and workflows
    models.ts               Core application types
  .github/workflows/
    deploy.yml              GitHub Pages deployment workflow
```

## Requirements

- Node.js 20+ recommended
- npm 10+ recommended

The project has been recently validated with:

- Node `v24.14.0`
- npm `11.9.0`

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open in the browser:

```text
http://localhost:5173
```

If port `5173` is already in use, Vite may automatically choose another local port.

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Notes:

- `npm run build` currently passes
- Vite still reports a chunk-size warning for a large bundle, but the build completes successfully

## Main Features

### Drawing tools

- `Select`
- `Line`
- `Potential`
- `Circle`
- `Arc`
- `Text`
- `Pin`
- `Pan`

### Editing

- Single and multi-selection
- Drag and resize
- Rotation in `15 deg` steps
- Horizontal and vertical mirror
- Alignment tools
- Move by numeric offset
- Group and ungroup selected shapes

### Pages

- Multi-page project support
- Bottom page tabs
- New page creation
- Page deletion

### Layers

- Create layers
- Rename layers
- Show/hide layers
- Lock/unlock layers
- Set active layer
- Move selected objects to another layer

### Potentials

- Potential number, name and wire diameter in `mm2`
- Snap to pins while drawing
- Automatic connection to other potentials
- T-connections and junction behavior
- Same-number potentials connect when touched during draw or edit
- Renumbering based on visual order

### Text

- Free text objects
- Linked text for internal navigation
- Special placeholders rendered on canvas and in exported PDF:
  - `<project>`
  - `<drawing>`
  - `<author>`
  - `<page>`
  - `<n_pages>`

### Components

Two component sources are supported:

1. `App Library`
2. `Project Components`

`App Library` components are bundled with the application from JSON files located in [`src/library/components`](./src/library/components).

`Project Components` are saved inside the project JSON file and travel with that project.

## Component Workflow

### Save a project component

1. Draw one or more shapes on the canvas
2. Select the desired shapes
3. Click `Save to Project` in the components panel

### Insert a component

- Click a component and then click on the canvas
- Or drag the component from the panel into the canvas

### Add a built-in component to the app

The recommended workflow is:

1. Draw the symbol in the CAD
2. Save it as a project component
3. Click `Download JSON`
4. Save the generated `.json` file
5. Add that file to `src/library/components`
6. Commit the file and rebuild the application

This approach works well for collaboration because contributors can design components in the running app and send JSON files without needing direct access to the source code.

## Project File Format

The current project file format is strict and only accepts the current schema.

The main `CadFile` structure contains:

- `version`
- `layers`
- `pages`
- `components`

Legacy compatibility was intentionally removed to keep import/export simpler and safer.

## Internationalization

Supported UI languages:

- English
- Portuguese (Brazil)

Language selection is available in the `Settings` tab and persisted in `localStorage`.

Translation resources live in [`src/i18n/resources.ts`](./src/i18n/resources.ts).

## Help Manual

The application includes built-in HTML manuals:

- [`public/help/manual.en.html`](./public/help/manual.en.html)
- [`public/help/manual.pt-BR.html`](./public/help/manual.pt-BR.html)

They are exposed through the `Help` button in the top toolbar and follow the active language.

## Keyboard Shortcuts

- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Y`: redo
- `Ctrl/Cmd + C`: copy
- `Ctrl/Cmd + X`: cut
- `Ctrl/Cmd + V`: paste
- `Delete` or `Backspace`: delete selection
- `Esc`: cancel current action or leave placement mode
- `Arrow keys`: move selection by grid step or by 1 unit

## PDF Export

PDF export supports:

- project name
- drawing name
- author
- sheet size
- orientation
- margins

Settings are configured in the `Settings` tab and applied during export.

## Deployment

This repository is configured for GitHub Pages deployment through GitHub Actions.

Important files:

- [`vite.config.ts`](./vite.config.ts)
- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

The app is built with:

- Vite `base` set to `/basic2dcad/`
- automatic deployment on push to `main`

Typical flow:

```bash
git add .
git commit -m "Your change"
git push
```

If the workflow build passes, GitHub Pages is updated automatically.

## Data and Storage Notes

- The app runs fully on the client side
- Project save/load is handled through browser file download/upload
- PDF export happens in the browser
- Built-in components are distributed with the application bundle
- Project components are stored in the project file itself

## Known Notes

- The production build currently shows a Vite chunk-size warning
- The project is intended to use only the current JSON schema
- Comments, variable names and code structure are kept in English

## Repository

- GitHub: `https://github.com/RicardoKers/basic2dcad`
