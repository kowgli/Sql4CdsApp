using Microsoft.Xrm.Sdk;
using System;
using System.Linq;
using Xrm.Domain.Crm;

namespace Xrm.Application.Queries
{
    public class AccountQueries : CrmQuery<Account>
    {
        public AccountQueries(IOrganizationService orgService) : base(orgService) { }

        public string GetName(Guid accountId)
        {
            using XrmContext xrm = new XrmContext(OrgService);

            return xrm.AccountSet.Where(a => a.AccountId == accountId).Select(a => a.Name).FirstOrDefault();
        }
    }
}
