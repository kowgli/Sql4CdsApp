# Sql4CdsApp

A **Dataverse plugin and web resource wrapper** around [Sql4Cds](https://github.com/MarkMpn/Sql4Cds) that enables running SQL queries against Dataverse directly from the **model-driven app web UI**.

## Overview

Sql4CdsApp integrates the Sql4Cds SQL engine into the Dataverse platform by combining:

- **Dataverse Plugins** — server-side logic that executes SQL queries via the Sql4Cds engine in a sandboxed plugin context
- **TypeScript Web Resources** — a browser-based SQL editor embedded in a model-driven app page, providing a developer/admin UI for writing and executing SQL against Dataverse tables

This allows users with appropriate Dataverse roles to run SQL queries against their environment directly from within a model-driven app, without needing external tools.

## Architecture

The solution follows a CQS (Command-Query Separation) pattern built on top of an Autofac-based `Bus` dispatcher:

| Project | Role |
|---|---|
| `Xrm.Domain` | Entities, DTOs, interfaces, `FlowArguments`, `Settings.Keys` |
| `Xrm.Application` | Command/event handlers and queries — business logic |
| `Xrm.Infrastructure` | `Bus` (DI + routing), `TransactionalService` |
| `Xrm.Plugin.Base` | Abstract `Plugin` base class, `LocalPluginContext`, `PluginStepConfig` |
| `Xrm.Plugins` | Concrete plugin implementations |
| `Xrm.WorkflowActivities` | Workflow activity implementations |
| `Xrm.Runner` | Scheduled/CLI jobs |
| `Xrm.UnitTests` | FakeXrmEasy-based unit tests |
| `WebResources/` | TypeScript web resources (SQL editor UI) |

## Build & Run

**Build:**
```
dotnet build Sql4CdsApp.sln
```

**Test:**
```
dotnet test Xrm.UnitTests\Xrm.UnitTests.csproj
```

**Web resources** — TypeScript compiles on save (`compileOnSave: true` in `tsconfig.json`). To bundle and sync:
```
__GENERATE_BUNDLES.bat
__SYNC WEB RESOURCES.bat
```

## Requirements

- .NET Framework (see project files for target version)
- A Dataverse / Dynamics 365 environment
- Connection string in `app.config` under the `CRM` key for tests and the Runner

## License

See [LICENSE.txt](LICENSE.txt).
