using Microsoft.Xrm.Sdk;
using System;
using System.Collections.Generic;
using Xrm.Application.Interfaces;
using Xrm.Application.Queries;
using Xrm.Domain.Configuration;

namespace DirectConfigurationReader
{
    public class ConfigurationReader : IConfigurationReader
    {
        private Dictionary<Settings.Keys, string> cache = new Dictionary<Settings.Keys, string>();

        readonly ConfigurationSettingsQueries configurationSettingsQueries = null;

        public ConfigurationReader(IOrganizationService orgService)
        {
            orgService = orgService ?? throw new ArgumentNullException(nameof(orgService));

            configurationSettingsQueries = new ConfigurationSettingsQueries(orgService);
        }

        public string GetSetting(Settings.Keys key)
        {
            if (!cache.ContainsKey(key))
            {
                cache[key] = configurationSettingsQueries.GetSetting(key);
            }

            return cache[key];
        }

        public string GetSettingOrDefault(Settings.Keys key)
        {
            try
            {
                return GetSetting(key);
            }
            catch
            {
                return "";
            }
        }
    }
}
