using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;
using Xrm.Domain.Crm;

namespace Xrm.Application.Queries
{
    public class SystemUserQueries : CrmQuery<SystemUser>
    {
        public SystemUserQueries(IOrganizationService orgService) : base(orgService)
        {
        }

        public bool IsSystemAdministrator(Guid userid)
        {
            // Based on microsoft sample
            // https://github.com/microsoft/PowerApps-Samples/blob/master/dataverse/orgsvc/CSharp/IsSystemAdminCustomAPI/IsSystemAdminCustomAPI/IsSystemAdmin.cs

            bool isSystemAdministrator = false;

            string systemUserRolesFetchXml = $@"<fetch mapping='logical' >
                      <entity name='systemuserroles'>
                        <attribute name='roleid'/>
                        <filter type='and'>
                          <condition attribute='systemuserid' operator='eq' value='{{0}}' /> 
                        </filter>
                        <link-entity name='role' alias='role' to='roleid' link-type='inner'>
                          <filter type='and'>
                            <condition alias='role' attribute='roletemplateid' operator='eq' value='627090FF-40A3-4053-8790-584EDC5BE201' /> </filter>
                        </link-entity>
                      </entity>
                    </fetch>";

            FetchExpression systemuserrolesQuery = new FetchExpression(string.Format(systemUserRolesFetchXml, userid));

            EntityCollection systemuserrolesResults = OrgService.RetrieveMultiple(systemuserrolesQuery);

            if (systemuserrolesResults.Entities.Count > 0)
            {
                isSystemAdministrator = true;
            }
            else
            {
                //The user may have the role due to an indirect association from team membership.
                string teamMemberShipFetchXml = $@"<fetch mapping='logical' >
                          <entity name='teamroles'>
                            <attribute name='roleid'/>
                            <link-entity name='teammembership' to='teamid' from='teamid' link-type='inner'>
                              <filter type='and'>
                                <condition attribute='systemuserid' operator='eq' value='{{0}}' />
                              </filter>
                            </link-entity>
                            <link-entity name='role' alias='role' to='roleid' from='roleid' link-type='inner'>
                              <filter type='and'>
                                <condition alias='role' attribute='roletemplateid' operator='eq' value='627090FF-40A3-4053-8790-584EDC5BE201' />
                              </filter>
                            </link-entity>
                          </entity>
                        </fetch>";

                FetchExpression teammembershipQuery = new FetchExpression(string.Format(systemUserRolesFetchXml, userid));

                EntityCollection teammembershipResults = OrgService.RetrieveMultiple(systemuserrolesQuery);
                if (systemuserrolesResults.Entities.Count > 0)
                {
                    isSystemAdministrator = true;
                }
                else
                {
                    isSystemAdministrator = false;
                }
            }

            return isSystemAdministrator;
        }
    }
}
