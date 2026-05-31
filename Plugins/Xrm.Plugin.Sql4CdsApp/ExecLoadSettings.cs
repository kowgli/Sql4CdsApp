using Xrm.Application.Commands;
using Xrm.Plugin.Base;

namespace Xrm.Plugin.Sql4CdsApp
{
    public class ExecLoadSettings : Base.Plugin
    {
        public ExecLoadSettings() : this("", "") { }

        public ExecLoadSettings(string unsecureConfig, string secureConfig) : base(typeof(ExecLoadSettings), unsecureConfig, secureConfig)
        {
            RegisterPluginStep<AnyEntity>(EventOperation.cd365_LoadSettings, ExecutionStage.PostOperation, Execute);
        }

        private void Execute(LocalPluginContext localContext)
        {
            var loadSettingsCrm = new LoadSettings { UserId = localContext.PluginExecutionContext.InitiatingUserId };
            localContext.Handle(loadSettingsCrm);

            var checkIsAdminCmd = new CheckIsAdmin { UserId = localContext.PluginExecutionContext.InitiatingUserId };
            localContext.Handle(checkIsAdminCmd);

            SetOutput(localContext, "Settings", loadSettingsCrm.Settings);
            SetOutput(localContext, "IsSystemAdmin", checkIsAdminCmd.IsAdministrator);
        }
    }
}
