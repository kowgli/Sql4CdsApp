using Xrm.Application.Commands;
using Xrm.Plugin.Base;

namespace Xrm.Plugin.Sql4CdsApp
{
    public class ExecSaveSettings : Base.Plugin
    {
        public ExecSaveSettings() : this("", "") { }

        public ExecSaveSettings(string unsecureConfig, string secureConfig) : base(typeof(ExecSaveSettings), unsecureConfig, secureConfig)
        {
            RegisterPluginStep<AnyEntity>(EventOperation.cd365_SaveSettings, ExecutionStage.PostOperation, Execute);
        }

        private void Execute(LocalPluginContext localContext)
        {

            localContext.Handle(
                new SaveSettings
                {
                    UserId = localContext.PluginExecutionContext.InitiatingUserId,
                    Settings = GetInput<string>(localContext, "Settings")
                }
            );
        }
    }
}
