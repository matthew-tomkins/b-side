# Project Overview

This project is a full-stack boilerplate for a web application using a combination of modern web technologies. It's structured to support development with a separate client and server, which are then built and served together in production.

- **Frontend (Client):** A React application built with Vite. It uses TypeScript for type safety and Tailwind CSS for styling. Client-side routing is handled by `react-router`.

- **Backend (Server):** An Express server written in TypeScript. It provides a simple API and serves the built React application in a production environment.

- **Build Process:** Vite is used for the client-side build, and `esbuild` is used to bundle the server-side code. `npm-run-all` is used to orchestrate the various build and development scripts.

## Building and Running

### Development

Prompt the user to run the development server themselves in a separate terminal window.

```bash
npm run dev
```

This will start the Vite development server for the client and the `tsx` watcher for the server.

- The client will be available at `http://localhost:5173`.
- The server will be available at `http://localhost:3000`.

### Production

To build the project for production, use the following command:

```bash
npm run build
```

This will create a `dist` directory with the bundled client and server files.

To start the server in production mode, use the following command:

```bash
npm start
```

### Testing

To run the tests, use the following command:

```bash
npm test -- --run
```

## Development Conventions

### Linting

This project uses ESLint to enforce code quality. To run the linter, use the following command:

```bash
npm run lint
```

### Formatting

This project uses Prettier to format the code. To format the code, use the following command:

```bash
npm run format
```

## Development Conventions

- **TypeScript:** The entire project, both client and server, is written in TypeScript, providing type safety and improved developer experience.

- **Directory Structure:** The project is organized into two main directories:
  - `client/`: Contains the React application.
  - `server/`: Contains the Express server.

- **Styling:** Tailwind CSS is used for styling. The configuration is in `tailwind.config.js`, and it scans the `index.html` and `client/**/*.tsx` files for classes.

- **Routing:** `react-router` is used for client-side routing. The routes are defined in `client/router.tsx`.

- **API:** The Express server exposes a simple REST API. An example endpoint is available at `/api/v1/greeting`.

## PromptKit Quick Reference
- Review the available artefacts when the student requests them:
  - Protocol: `promptkit/protocols/setup.md` — instructions for updating these CLI briefings.
  - Workflow: `promptkit/workflows/tutor.md` — guide for tutoring/explanation sessions.
  - Workflow: `promptkit/workflows/reflect.md` — guide for documenting outcomes and next steps.
- Student notes live in `promptkit/notes/`; The table in `progress-journal.md` is main place to update with reflections. Instructor Activities are in `promptkit/activities/` (read-only).
- When new workflows arrive, expect additional files under `promptkit/workflows/`.