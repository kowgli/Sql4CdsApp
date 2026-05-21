# Copilot Instructions for Sql4CdsApp

This is a **Dataverse plugin and web resource wrapper around [Sql4Cds](https://github.com/MarkMpn/Sql4Cds)**, enabling users to run SQL queries against Dataverse directly from a model-driven app web UI. It exposes a TypeScript-based SQL editor as a web resource and uses Dataverse plugins to execute queries server-side via the Sql4Cds engine. The project follows a CQS (Command-Query Separation) pattern and supports plugins, workflow activities, a scheduled-job runner, and TypeScript web resources.

---

## Build & Test

**Build the solution:**
```
dotnet build Sql4CdsApp.sln
```

**Run all tests:**
```
dotnet test Xrm.UnitTests\Xrm.UnitTests.csproj
```

**Run a single test class or method:**
```
dotnet test Xrm.UnitTests\Xrm.UnitTests.csproj --filter "FullyQualifiedName~MyTestClass"
```

Unit tests that call `OrgService` or `OrgServiceWrapper` (live CRM) require a valid connection string in `Xrm.UnitTests\app.config` under the `CRM` key. Tests using only `Context` (FakeXrmEasy) run without a CRM connection.

**Web resources (TypeScript):**
- TypeScript compiles on save via `tsconfig.json` (`compileOnSave: true`, target `es2019`, no modules)
- Bundle: run `__GENERATE_BUNDLES.bat`
- Sync to CRM: run `__SYNC WEB RESOURCES.bat` (uses `web-resource-mappings.json` for source→target mapping and connection string)

---

## Architecture Overview

### Layer responsibilities

| Project | Role |
|---|---|
| `Xrm.Domain` | Entities (CRM early-bound), DTOs, interfaces (`ICommand`, `IEvent`, etc.), `FlowArguments`, `OrganizationServiceWrapper`, `Settings.Keys` enum |
| `Xrm.Application` | Command handlers, event handlers, queries — all business logic lives here |
| `Xrm.Infrastructure` | `Bus` (Autofac DI, command routing), `TransactionalService`, fakes for tests |
| `Xrm.Plugin.Base` | Abstract `Plugin` base class, `LocalPluginContext`, `PluginStepConfig` |
| `Xrm.Plugins` | Concrete plugin implementations (inherit `Xrm.Plugin.Base.Plugin`) |
| `Xrm.WorkflowActivities` | Concrete workflow activities (inherit `BaseActivity`) |
| `Xrm.Runner` | Scheduled/CLI jobs; jobs extend `BaseCrmJob` + implement `IOperation` (CCP framework) |
| `Xrm.UnitTests` | Tests using FakeXrmEasy; base class `BaseCrmTest` wires up a `Bus` and fakes |
| `Modules/` | Standalone utility libraries (JSON, XML helpers, config readers, file system, HTTP) |
| `WebResources/` | TypeScript web resources for CRM forms |

### The Bus and CQS flow

`Bus` (in `Xrm.Infrastructure`) is the central dispatcher. It uses **Autofac** to scan the `Xrm.Application` assembly and auto-register all:
- `IHandleCommand<TCommand>` implementations
- `IHandleEvent<TEvent>` implementations
- `CrmQuery<TEntity>` subclasses

When `bus.Handle(command, flowArgs)` is called, Autofac resolves the correct handler and injects its dependencies. After the handler runs, if a `TransactionalService` is in play, it commits automatically.

`FlowArguments` is the single object passed through the entire handling chain, bundling: `OrgServiceWrapper`, `TracingService`, `IEventBus`, and `ICommandBus`.

### OrganizationServiceWrapper

Exposes four `IOrganizationService` instances:
- `OrgService` — runs as the initiating user
- `OrgServiceAsSystem` — runs as SYSTEM
- `TransactionalOrgService` / `TransactionalOrgServiceAsSystem` — transactional variants (committed after each command)

---

## Key Conventions

### Command + Handler pattern

The **Handler is a nested class** inside the Command class. Always follow this structure:

```csharp
public class MyCommand : ICommand
{
    // Input properties
    public Account Target { get; set; }

    public class Handler : CommandHandler<MyCommand>   // or CommandHandler<MyCommand, TResultEvent>
    {
        private readonly MyQueries myQueries;

        public Handler(FlowArguments flowArgs, MyQueries myQueries) : base(flowArgs)
        {
            this.myQueries = myQueries ?? throw new ArgumentNullException(nameof(myQueries));
        }

        public override VoidEvent Execute(MyCommand command)
        {
            // business logic
            return VoidEvent;
        }

        public override bool Validate(MyCommand command) { /* optional */ return true; }
    }
}
```

Use `CommandHandler<TCommand, TResultEvent>` when the handler should raise a domain event after execution. The event is automatically dispatched to all `IHandleEvent<TResultEvent>` listeners.

Use `TriggerCommand(anotherCommand)` inside a handler to chain commands through the same bus/flow.

### Queries

Queries extend `CrmQuery<TEntity>` and receive `IOrganizationService` via constructor (injected by the Bus). They can use LINQ-to-CRM via `XrmContext` or `QueryExpression`. `RetrieveMultiple` handles paging automatically (up to 5000 records per page).

```csharp
public class AccountQueries : CrmQuery<Account>
{
    public AccountQueries(IOrganizationService orgService) : base(orgService) { }

    public string GetName(Guid id)
    {
        using XrmContext xrm = new XrmContext(OrgService);
        return xrm.AccountSet.Where(a => a.AccountId == id).Select(a => a.Name).FirstOrDefault();
    }
}
```

Decorate a query parameter with `[InUserContext]` to inject the user-context org service instead of the system service:

```csharp
public Handler(FlowArguments flowArgs, [InUserContext] AccountQueries userAccountQueries) : base(flowArgs) { }
```

### Plugins

Plugins inherit from `Xrm.Plugin.Base.Plugin`. Register steps in the constructor via the fluent `RegisterPluginStep<TEntity>` API:

```csharp
public class MyPlugin : Base.Plugin
{
    public MyPlugin() : this("", "") { }
    public MyPlugin(string unsecureConfig, string secureConfig)
        : base(typeof(MyPlugin), unsecureConfig, secureConfig)
    {
        RegisterPluginStep<Account>(EventOperation.Update, ExecutionStage.PostOperation, Execute)
            .AddFilteredAttributes(x => x.Name)
            .AddImage(ImageType.PreImage);
    }

    private void Execute(LocalPluginContext localContext)
    {
        Account target = localContext.GetTarget<Account>();
        localContext.Handle(new MyCommand { Target = target });
    }
}
```

`localContext.Handle(command)` dispatches to the Bus. Commands can be disabled at runtime via a JSON list in the plugin's **unsecure config** (the `disabledCommands` array).

### Workflow Activities

Activities inherit from `BaseActivity` and override `InternalExecute()`:

```csharp
public class MyActivity : BaseActivity
{
    protected override void InternalExecute()
    {
        Handle(new MyCommand());
    }
}
```

### Runner Jobs

Jobs inherit from `BaseCrmJob` and implement `IOperation` (CCP framework). Parameters become public properties; mark required ones with `[Required]`.

```csharp
public class MyJob : BaseCrmJob, IOperation
{
    [Required]
    public string SomeParam { get; set; }

    public void Run()
    {
        Handle(new MyCommand { SomeParam = SomeParam });
    }
}
```

Run from CLI: `Xrm.Runner.exe MyJob --SomeParam=value`

### Configuration / Settings

- Add setting keys to the `Settings.Keys` enum in `Xrm.Domain\Configuration\Settings.cs`.
- In plugins: use `PluginSettingsConfigurationReader` (reads from plugin secure config JSON).
- In Runner jobs: use `DirectConfigurationReader` (reads from a CRM custom settings entity).
- Inject via `IConfigurationReader` (registered in the Bus constructor).

### Connection Strings

Both `Xrm.Runner` and `Xrm.UnitTests` read a `CRM` connection string from `app.config`. The Runner additionally supports **Azure Key Vault** lookup: prefix the connection string value with `VaultUrl=https://...vault.azure.net/; Key=MySecret` and ensure `az login` has been run.

### Unit Testing

Extend `BaseCrmTest`. Use `Context` (`XrmFakedContext` from FakeXrmEasy) to seed in-memory CRM data. Use `FakeDateProvider`, `FakeConfigurationReader`, `FakeHttpRequestExecutor` as test doubles. Set `DoNotPropagateEvents = true` on the Bus to test a handler in isolation without triggering downstream event listeners.

```csharp
public class MyCommandTests : BaseCrmTest
{
    [TestMethod]
    public void MyCommand_DoesX()
    {
        Context.Initialize(new[] { new Account { Id = Guid.NewGuid(), Name = "Test" } });
        var fakeService = Context.GetOrganizationService();
        var wrapper = new OrganizationServiceWrapper(fakeService);
        var bus = new Bus(FakeDateProvider) { DoNotPropagateEvents = true };
        var flowArgs = new FlowArguments(wrapper, FakeTracing, bus, bus);

        bus.Handle(new MyCommand { ... }, flowArgs);

        // assert
    }
}
```
