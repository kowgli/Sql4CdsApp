using Microsoft.Xrm.Sdk;
using System;
using Xrm.Infrastructure;
using Xrm.Domain.Crm;
using Xrm.Domain.Interfaces;

namespace Xrm.Plugin.Base
{
    public class LocalPluginContext
    {
        public IServiceProvider ServiceProvider { get; }

        public IOrganizationServiceWrapper OrgServiceWrapper { get; }

        public IPluginExecutionContext PluginExecutionContext { get; }

        public ITracingService TracingService { get; }

        #region XrmProjectTemplate
        private readonly Bus bus;

        public Entity GetTarget()
        {
            return (Entity)this.PluginExecutionContext.InputParameters["Target"];
        }

        public EntityReference GetTargetReference()
        {
            return (EntityReference)this.PluginExecutionContext.InputParameters["Target"];
        }

        public T GetTarget<T>() where T : Entity
        {
            Entity target = GetTarget();
            return target.ToEntity<T>();
        }

        public Entity GetPreImage()
        {
            if (!PluginExecutionContext.PreEntityImages.ContainsKey("PreImage"))
            {
                throw new InvalidPluginExecutionException("LocalPluginContext.GetPreImage(): PreImage not found in PreEntityImages.");
            }

            return this.PluginExecutionContext.PreEntityImages["PreImage"];
        }

        public T GetPreImage<T>() where T : Entity
        {
            return GetPreImage().ToEntity<T>();
        }

        public bool IsCreate()
        {
            return this.PluginExecutionContext.MessageName.ToLowerInvariant() == "create";
        }

        public bool IsUpdate()
        {
            return this.PluginExecutionContext.MessageName.ToLowerInvariant() == "update";
        }
        #endregion


        internal LocalPluginContext(IServiceProvider serviceProvider, Bus bus)
        {
            serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            this.bus = bus ?? throw new ArgumentNullException(nameof(bus));

            // Obtain the execution context service from the service provider.
            this.PluginExecutionContext = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            // Obtain the tracing service from the service provider.
            this.TracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            // Obtain the Organization Service factory service from the service provider
            IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

            // Use the factory to generate the Organization Service.
            IOrganizationService orgService = factory.CreateOrganizationService(this.PluginExecutionContext.UserId);
            IOrganizationService orgServiceAsSystem = factory.CreateOrganizationService(null);

            OrgServiceWrapper = new OrganizationServiceWrapper(orgService, orgServiceAsSystem, new TransactionalService(orgService), new TransactionalService(orgServiceAsSystem));
        }

        public void Trace(string message)
        {
            if (string.IsNullOrWhiteSpace(message) || this.TracingService == null)
            {
                return;
            }

            if (this.PluginExecutionContext == null)
            {
                this.TracingService.Trace(message);
            }
            else
            {
                this.TracingService.Trace(
                    "{0}, Correlation Id: {1}, Initiating User: {2}",
                    message,
                    this.PluginExecutionContext.CorrelationId,
                    this.PluginExecutionContext.InitiatingUserId);
            }
        }

        public void Handle(ICommand command)
        {
            bus.Handle(command, new Domain.Flow.FlowArguments(OrgServiceWrapper, TracingService, bus, bus));
        }
    }
}
