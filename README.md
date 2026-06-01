# Sql4CdsApp

A **Dataverse plugin and web resource wrapper** around [Sql4Cds](https://github.com/MarkMpn/Sql4Cds) that enables running SQL queries against Dataverse directly from the **model-driven app web UI** without any external dependencies and configuration required.

![Sql4CdsApp Screenshot](Docs/screenshot.png)

## How to install?

Import the solution from the [releases page](https://github.com/kowgli/Sql4CdsApp/releases/tag/Release) into your Dataverse environment. The solution includes a model-driven app with a web resource for the SQL editor, and plugins that execute the SQL queries.

## Overview

Sql4CdsApp integrates the Sql4Cds SQL engine into the Dataverse platform by combining:

- **Dataverse Plugins** — server-side logic that executes SQL queries via the Sql4Cds engine in a sandboxed plugin context
- **TypeScript Web Resources** — a browser-based SQL editor embedded in a model-driven app page, providing a developer/admin UI for writing and executing SQL against Dataverse tables

This allows users with appropriate Dataverse roles to run SQL queries against their environment directly from within a model-driven app, without needing external tools.

## Security

All queries exectuted through Sql4CdsApp are subject to Dataverse's security model, ensuring that users can only access data they have permissions for. The plugin executes queries in a sandboxed environment, and the web resource is only accessible to users with the necessary roles.
Currently the app is designed for users with the System Administrator role, but it can be customized to allow other roles as needed.

## Performance

While Sql4CdsApp provides a convenient way to run SQL queries against Dataverse, it's important to note that performance may vary based on the complexity of the queries and the size of the data. It's recommended to use this tool for development, testing, and administrative purposes rather than for high-volume production workloads.

The plugin sandbox environment has certain limitations, such as limited execution time, memory limitations and single thread execution, which may impact the performance of complex queries. Always test your queries in a non-production environment before running them in production.

For complex queries or large datasets use the proper Sql4Cds tool inside XrmToolBox or SSMS for better performance and more advanced features.

## No warenties

Although the tool doesn't have any known issues, it is provided as-is without any warranties. Use it at your own risk and always test in a non-production environment first. Take special care when writing bulk data manipulating queries like `INSERT`, `UPDATE`, or `DELETE` as they can have significant impact on your data if not used correctly.

## License

See [LICENSE.txt](LICENSE.txt).
