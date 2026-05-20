using Xrm.Application.Interfaces;
using Xrm.Domain.Configuration;

namespace Xrm.Infrastructure.Fakes
{
    public class BlankConfigurationReader : IConfigurationReader
    {
        public string GetSetting(Settings.Keys key) => "";

        public string GetSettingOrDefault(Settings.Keys key) => "";
    }
}
