#pragma warning disable CS0162 // Unreachable code detected

using Microsoft.Xrm.Sdk;
using System;
using System.Linq;
using Xrm.Domain.Configuration;
using Xrm.Domain.Crm;
using Xrm.Domain.DTO;

namespace Xrm.Application.Queries
{
    public class ConfigurationSettingsQueries : CrmQuery<Entity/*mm365_ConfigurationSetting*/>
    {
        public ConfigurationSettingsQueries(IOrganizationService orgService) : base(orgService)
        {
        }

        public ConfigurationSetting[] GetAllNormalized()
        {
            throw new NotImplementedException();


            using var xrm = new XrmContext(OrgService);


            //return xrm.gs365_ConfigurationSettingSet
            //          .Where(cs => cs.statecode == mm365_ConfigurationSettingState.Active)
            //          .OrderBy(cs => cs.mm365_name)
            //          .Select(cs => new ConfigurationSetting
            //          {
            //              Key = cs.mm365_name ?? "",
            //              Value = cs.mm365_Value ?? "",
            //          })
            //          .ToArray();
        }

        /// <remarks>Do not use inside plugins. Use the IConfigurationReader.</remarks>
        public string GetSetting(Settings.Keys key)
        {
            throw new NotImplementedException();

            //using var xrm = new XrmContext(OrgService);
            //string settingKey = key.ToString();            

            //return xrm.gs365_ConfigurationSettingSet
            //          .Where(cs => cs.mm365_name == settingKey)
            //          .Select(cs => cs.mm365_Value)
            //          .FirstOrDefault() ?? throw new ArgumentOutOfRangeException($"Setting {settingKey} not found.");
        }

        public string GetPublicSetting(string name)
        {
            throw new NotImplementedException();

            //using var xrm = new XrmContext(OrgService);

            //return xrm.gs365_ConfigurationSettingSet
            //          .Where(cs => cs.statecode == mm365_ConfigurationSettingState.Active
            //                       && cs.mm365_name == name
            //                       && cs.mm365_Public == true
            //          )
            //          .Select(cs => cs.mm365_Value)
            //          .FirstOrDefault();
        }

        public EntityReference GetExistingSecureSettingsId(Guid sdkMessageProcessingStepId)
        {
            throw new NotImplementedException();

            //using var xrm = new XrmContext(OrgService);
            //return xrm.SdkMessageProcessingStepSet
            //          .Where(s => s.SdkMessageProcessingStepId == sdkMessageProcessingStepId)
            //          .Select(s => s.SdkMessageProcessingStepSecureConfigId)
            //          .FirstOrDefault();
        }
    }
}

#pragma warning restore CS0162 // Unreachable code detected
