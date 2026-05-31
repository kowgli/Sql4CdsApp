using FakeXrmEasy;
using Microsoft.Xrm.Sdk;
using Xrm.Infrastructure;
using Xrm.Domain.Crm;
using Xrm.Domain.Flow;
using Xrm.Domain.Interfaces;
using Xrm.UnitTests.Fakes;
using Microsoft.Xrm.Tooling.Connector;
using System;

namespace Xrm.UnitTests
{
    public abstract class BaseCrmTest
    {
        protected FakeDateProvider FakeDateProvider { get; set; } = new FakeDateProvider(DateTime.UtcNow);
        protected FakeConfigurationReader FakeConfigurationReader = new FakeConfigurationReader();
        protected FakeHttpRequestExecutor FakeHttpRequestExecutor = new FakeHttpRequestExecutor();

        protected XrmFakedContext Context { get; set; } = new XrmFakedContext();

        public IOrganizationService OrgService
        {
            get
            {
                string connectionString = System.Configuration.ConfigurationManager.ConnectionStrings["CRM"].ConnectionString;
                var client = new CrmServiceClient(connectionString);

                if (!client.IsReady)
                {
                    throw new Exception(client.LastCrmError);
                }

                return client;
            }
        }

        protected OrganizationServiceWrapper OrgServiceWrapper => new OrganizationServiceWrapper(OrgService);

        protected ITracingService FakeTracing = new FakeTracingService();

        protected ICommandBus CmdBus => new Bus();

        protected ICommandBus CmdBusWithNoEventPropagation => new Bus() { DoNotPropagateEvents = true };

        protected IEventBus EventBus => new Bus();

        protected FlowArguments FlowArgs => new FlowArguments(OrgServiceWrapper, FakeTracing, EventBus, CmdBus);

    }
}
