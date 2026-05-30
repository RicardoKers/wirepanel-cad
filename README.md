# WirePanel CAD

Browser-based 2D CAD for industrial electrical drawings, built with React, TypeScript and Vite.

## Overview

WirePanel CAD is a lightweight web CAD focused on electrical schematics and panel drawings. It runs fully in the browser and stores user project data in `.wpp` files handled by the user.

Current highlights:

- 2D drawing tools for lines, potentials, circles, arcs, text and pins
- Selection, move, resize, align, mirror, rotate, group and ungroup workflows
- Layers with visibility, locking and active-layer editing
- Grid, snap and pan/zoom navigation
- Electrical potentials with numbering, names, wire size in `mm2` and renumbering
- Pin snapping and automatic potential connections
- Component system with:
  - built-in app library from `.wpm` model files
  - project models imported/exported as `.wpm`
  - project components stored inside the `.wpp` project file
- Intelligent component instances with tag prefix/number, type, linked label and `Part of` relationships
- Cross-reference addresses based on the sheet marker grid
- PDF export with page settings and special text placeholders
- English and Brazilian Portuguese interface
- Built-in HTML help manual available from the app

## Live Site

GitHub Pages:

- `https://ricardokers.github.io/wirepanel-cad/`

## Tech Stack

- React 18
- TypeScript
- Vite 5
- jsPDF
- i18next + react-i18next

## Project Structure

```text
wirepanel-cad/
  public/
    help/                   HTML manuals used by the app
  src/
    components/             React UI panels and canvas
    i18n/                   Language setup and translation resources
    library/
      components/           Built-in component source files
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
- Selection context menu for delete, transform, align, group, ungroup, create component and move to layer
- Group and ungroup selected shapes
- Double-click a group or component body to edit its internal shapes without ungrouping it
- `Esc` clears the current selection, cancels placement/dialog states and exits group edit mode

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

### Pins

- Pins define precise electrical connection points for potentials and reusable components
- New pins use the default tag `X`
- Pin tag text defaults to font size `2.5`
- Pin tag text starts slightly to the right and below the connection point for readable terminal labels
- The connection X marker is hidden by default and can be enabled in Project settings

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

`App Library` components are bundled with the application from source files located in [`src/library/components`](./src/library/components).

`Project Components` are saved inside the project `.wpp` file and travel with that project.

Project model files exported from the Library use the `.wpm` extension. Project files use `.wpp`.

## Component Workflow

### Save a project model

1. Draw one or more shapes on the canvas
2. Select the desired shapes
3. Use the `+` button in the Library header

### Insert a model

- Click or drag a model from the Library onto the canvas
- If the model includes a default tag prefix, insertion creates a new intelligent component instance
- The new instance receives the next sequential number for that prefix

### Intelligent components

1. Draw a symbol
2. Group the symbol
3. Right-click the group and choose `Create component`
4. Enter a tag prefix such as `K`, a type such as `Contactor`, and optionally a parent in `Part of`

Component instances have an invisible `componentId`, a visible linked label, editable tag prefix/number, type, and optional parent relationship.

The default component label appears to the left of the symbol, right-aligned and vertically centered. Subcomponents can show the parent address below the tag label.

To adjust geometry inside a grouped symbol or component, double-click the group on the canvas. While the group is open for editing, its internal lines, texts and pins can be selected and edited from the Object panel. Press `Esc` to leave the group edit mode.

Coordinate and offset fields in the Object panel are displayed with compact rounded values, so small floating-point residues do not clutter the inspector while the drawing remains editable.

### Parts and cross-references

- A component can be marked as `Part of` another component
- Parts inherit the parent tag prefix and number
- Main components can show their parts above, below, left or right
- Part spacing uses the real rotated/scaled symbol size
- Component addresses are generated from page markers, for example `1.C2`
- `Ctrl/Cmd + click` on component reference text jumps to the related component

### IO references

Components can also be marked as `IO of` another component without using the `Part of` relationship. This is intended for distributed PLC or controller inputs and outputs.

1. Create the main component, such as a PLC, with named pins like `I0.0` or `Q0.0`.
2. Create a separate IO component elsewhere in the diagram.
3. In Object properties, enable `IO of`, choose the main component and then choose one of its pins.

The IO component shows the address of the selected main pin. The selected pin on the main component shows the address of the IO component. Both reference texts have independent X/Y offset, rotation, alignment and size settings, and `Ctrl/Cmd + click` navigates to the linked target.

### Add a built-in component to the app

The recommended workflow is:

1. Draw the symbol in the CAD
2. Save it as a project component
3. Click `Download WPM`
4. Save the generated `.wpm` file
5. Add that file to `src/library/components`
6. Commit the file and rebuild the application

This approach works well for collaboration because contributors can design components in the running app and send `.wpm` files without needing direct access to the source code.

## File Formats

User-facing files use distinct extensions:

- `.wpp`: WirePanel Project, used by Download Project and Upload Project
- `.wpm`: WirePanel Model, used by Library model import/export

The main `CadFile` structure contains:

- `version`
- `layers`
- `pages`
- `components`
- `componentInstances`

The current project file format is strict and only accepts the current schema. Current saves use format version `5`. Legacy compatibility was intentionally removed to keep import/export simpler and safer.

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
- `Esc`: clear selection, cancel current action, leave placement mode or exit group edit mode
- `Arrow keys`: move selection by grid step or by 1 unit

## PDF Export

PDF export supports:

- project name
- drawing name
- author
- sheet size
- orientation
- margins
- visible component labels
- linked part references
- IO references and IO pin-name labels
- internal clickable links on component, part and IO address references

Settings are configured in the `Settings` tab and applied during export.

## Deployment

This repository is configured for GitHub Pages deployment through GitHub Actions.

Important files:

- [`vite.config.ts`](./vite.config.ts)
- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

The app is built with:

- Vite `base` set to `/wirepanel-cad/`
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
- Project save/load is handled through browser `.wpp` file download/upload
- PDF export happens in the browser
- Built-in components are distributed with the application bundle
- Project components and component instances are stored in the project file itself

## Known Notes

- The production build currently shows a Vite chunk-size warning
- The project is intended to use only the current `.wpp` schema
- Comments, variable names and code structure are kept in English

## Repository

- GitHub: `https://github.com/RicardoKers/wirepanel-cad`
