using DateProvider;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Tooling.Connector;
using System;
using Xrm.Infrastructure;
using Xrm.Domain.Crm;
using Xrm.Domain.Interfaces;

namespace Xrm.Runner.Jobs
{
    public class BaseCrmJob
    {
        private readonly OrganizationServiceWrapper orgServiceWrapper = null;

        protected ITracingService TracingService = new NLogTracer();
        private readonly Bus bus = null;

        public BaseCrmJob()
        {
            IOrganizationService orgService = GetOrgService();

            orgServiceWrapper = new OrganizationServiceWrapper(orgService, orgService, new TransactionalService(orgService), new TransactionalService(orgService));
            bus = new Bus(new SystemDateProvider(), new DirectConfigurationReader.ConfigurationReader(orgService));
        }

        protected void Handle(ICommand command)
        {
            bus.Handle(command, new Domain.Flow.FlowArguments(orgServiceWrapper, TracingService, bus, bus));
        }

        public IOrganizationService GetOrgService()
        {
            string connectionString = System.Configuration.ConfigurationManager.ConnectionStrings["CRM"].ConnectionString;

            connectionString = ConnectionStringProvider.ConnectionString.Get(connectionString); // Gets conn string with optional query to AKV

            var client = new CrmServiceClient(connectionString);

            if (!client.IsReady)
            {
                throw new Exception(client.LastCrmError);
            }

            return client;
        }
    }
}
